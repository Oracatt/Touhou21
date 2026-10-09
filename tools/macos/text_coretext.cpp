#include "tsstg/text.hpp"
#include "coretext_support.hpp"
#include <algorithm>
#include <cmath>
#include <map>
#include <stdexcept>

namespace tsstg {
namespace {
using macos::CF;
struct Line {
    CF<CTLineRef> line;
    double x=0,baseline=0;
};
struct Layout {
    std::vector<Line> lines;
};
}

// CoreText shapes, wraps and aligns the text like the DirectWrite layout.
// Drawing uses the actual glyph outlines, transformed before stroking so
// strokeWidth remains in output pixel units.
struct PlatformText::Impl {
    std::map<std::uint32_t,Layout> layouts;
};

PlatformText::PlatformText():impl_(std::make_unique<Impl>()){}
PlatformText::~PlatformText()=default;
void PlatformText::createLayout(std::uint32_t id,const std::string& text,const TextLayoutOptions& options){
    const auto family=macos::resolveFamily(options.fontFamily);
    if(!family)throw std::runtime_error("System font family is unavailable: "+options.fontFamily);
    const auto font=macos::createFont(*family,options.fontSize);
    const auto content=macos::cfString(text);
    const auto attributed=macos::attributedText(content.get(),font.get(),macos::languageTag(options.locale));
    CF<CTTypesetterRef> typesetter(CTTypesetterCreateWithAttributedString(attributed.get()));
    if(!typesetter)throw std::runtime_error("Cannot create CoreText typesetter");
    const double flush=options.horizontalAlign=="right"?1:options.horizontalAlign=="center"?0.5:0;
    Layout layout;double bottom=0;
    for(CFIndex start=0,length=CFStringGetLength(content.get());start<length;){
        const auto count=std::max<CFIndex>(1,CTTypesetterSuggestLineBreak(typesetter.get(),start,options.width));
        Line line{CF<CTLineRef>(CTTypesetterCreateLine(typesetter.get(),CFRangeMake(start,count)))};
        if(!line.line)throw std::runtime_error("Cannot create CoreText line");
        CGFloat ascent=0,descent=0,leading=0;CTLineGetTypographicBounds(line.line.get(),&ascent,&descent,&leading);
        line.x=CTLineGetPenOffsetForFlush(line.line.get(),flush,options.width);
        line.baseline=bottom+ascent;bottom+=ascent+descent+leading;
        layout.lines.push_back(std::move(line));start+=count;
    }
    const double offset=options.verticalAlign=="bottom"?options.height-bottom:options.verticalAlign=="center"?(options.height-bottom)/2:0;
    for(auto& line:layout.lines)line.baseline=std::round(line.baseline+offset);
    impl_->layouts.emplace(id,std::move(layout));
}
void PlatformText::destroyLayout(std::uint32_t id){
    if(!impl_->layouts.erase(id))throw std::runtime_error("Unknown text layout id: "+std::to_string(id));
}
RasterizedText PlatformText::rasterize(std::uint32_t id,const TextRasterOptions& options){
    const auto found=impl_->layouts.find(id);
    if(found==impl_->layouts.end())throw std::runtime_error("Unknown text layout id: "+std::to_string(id));
    const auto stride=static_cast<std::size_t>(options.width)*4;
    std::vector<std::uint8_t> full(stride*options.height);
    CF<CGColorSpaceRef> space(CGColorSpaceCreateDeviceRGB());
    CF<CGContextRef> context(CGBitmapContextCreate(full.data(),options.width,options.height,8,stride,space.get(),kCGImageAlphaPremultipliedLast|kCGBitmapByteOrder32Big));
    if(!context)throw std::runtime_error("Cannot create CoreGraphics text raster");
    const auto target=context.get();
    CGContextTranslateCTM(target,0,options.height);CGContextScaleCTM(target,1,-1);
    CGContextSetShouldAntialias(target,true);
    CGContextSetLineJoin(target,kCGLineJoinMiter);CGContextSetMiterLimit(target,10);CGContextSetLineCap(target,kCGLineCapButt);
    CGContextSetLineWidth(target,options.strokeWidth);
    const auto channel=[](std::uint32_t rgba,int shift){return static_cast<CGFloat>((rgba>>shift)&255)/255;};
    CGContextSetRGBFillColor(target,channel(options.fill,24),channel(options.fill,16),channel(options.fill,8),channel(options.fill,0));
    CGContextSetRGBStrokeColor(target,channel(options.outline,24),channel(options.outline,16),channel(options.outline,8),channel(options.outline,0));
    const auto place=CGAffineTransformConcat(CGAffineTransformConcat(CGAffineTransformConcat(
        CGAffineTransformMakeTranslation(options.layoutX,options.layoutY),CGAffineTransformMakeScale(options.scale,options.scale)),
        CGAffineTransformMakeRotation(options.rotation)),CGAffineTransformMakeTranslation(options.x,options.y));
    const bool stroke=options.strokeWidth>0&&(options.outline&255),fill=(options.fill&255)!=0;
    for(const auto& line:found->second.lines){
        const auto runs=CTLineGetGlyphRuns(line.line.get());
        for(CFIndex index=0,runCount=CFArrayGetCount(runs);index<runCount;++index){
            const auto run=static_cast<CTRunRef>(CFArrayGetValueAtIndex(runs,index));
            const auto count=CTRunGetGlyphCount(run);if(count<1)continue;
            const auto font=static_cast<CTFontRef>(CFDictionaryGetValue(CTRunGetAttributes(run),kCTFontAttributeName));
            std::vector<CGGlyph> glyphs(static_cast<std::size_t>(count));std::vector<CGPoint> positions(static_cast<std::size_t>(count));
            CTRunGetGlyphs(run,CFRangeMake(0,0),glyphs.data());CTRunGetPositions(run,CFRangeMake(0,0),positions.data());
            CF<CGMutablePathRef> path(CGPathCreateMutable());
            for(std::size_t i=0;i<glyphs.size();++i){
                const auto glyph=CGAffineTransformConcat(CGAffineTransformMake(1,0,0,-1,line.x+positions[i].x,line.baseline-positions[i].y),place);
                CF<CGPathRef> outline(CTFontCreatePathForGlyph(font,glyphs[i],&glyph));
                if(outline)CGPathAddPath(path.get(),nullptr,outline.get());
            }
            if(CGPathIsEmpty(path.get()))continue;
            if(stroke){CGContextAddPath(target,path.get());CGContextStrokePath(target);}
            if(fill){CGContextAddPath(target,path.get());CGContextFillPath(target);}
        }
    }
    int left=options.width,top=options.height,right=-1,bottom=-1;
    for(int y=0;y<options.height;++y)for(int x=0;x<options.width;++x)if(full[(static_cast<std::size_t>(y)*options.width+x)*4+3]){
        left=(std::min)(left,x);top=(std::min)(top,y);right=(std::max)(right,x);bottom=(std::max)(bottom,y);
    }
    RasterizedText result;if(right<left)return result;
    result.x=left;result.y=top;result.width=right-left+1;result.height=bottom-top+1;
    result.pixels.resize(static_cast<std::size_t>(result.width)*result.height*4);
    for(int y=0;y<result.height;++y)for(int x=0;x<result.width;++x){
        const auto src=(static_cast<std::size_t>(y+top)*options.width+x+left)*4,dst=(static_cast<std::size_t>(y)*result.width+x)*4;
        const auto alpha=full[src+3];
        for(unsigned c=0;c<3;++c){const auto value=full[src+c];result.pixels[dst+c]=!alpha?0:options.premultiplied?value:static_cast<std::uint8_t>((std::min)(255u,(static_cast<unsigned>(value)*255u+alpha/2u)/alpha));}
        result.pixels[dst+3]=alpha;
    }
    return result;
}
}
