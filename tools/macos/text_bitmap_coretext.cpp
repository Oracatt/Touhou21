#include "tsstg/text.hpp"
#include "coretext_support.hpp"
#include <algorithm>
#include <cmath>
#include <map>
#include <optional>
#include <stdexcept>

namespace tsstg {
namespace {
using macos::CF;
constexpr std::uint32_t nonantialiasedQuality=3,shiftJisCharSet=128,gb2312CharSet=134,big5CharSet=136;

CFStringEncoding codePageEncoding(std::uint32_t codePage){
    const auto encoding=codePage==65001?kCFStringEncodingUTF8:CFStringConvertWindowsCodepageToEncoding(codePage);
    if(encoding==kCFStringEncodingInvalidId||!CFStringIsEncodingAvailable(encoding))throw std::runtime_error("Unsupported text code page: "+std::to_string(codePage));
    return encoding;
}
std::vector<std::uint8_t> encode(CFStringRef text,CFStringEncoding encoding){
    const auto range=CFRangeMake(0,CFStringGetLength(text));CFIndex size=0;
    CFStringGetBytes(text,range,encoding,'?',false,nullptr,0,&size);
    std::vector<std::uint8_t> bytes(static_cast<std::size_t>(size));
    if(size&&CFStringGetBytes(text,range,encoding,'?',false,bytes.data(),size,&size)!=range.length)throw std::runtime_error("Text encoding failed");
    return bytes;
}
bool endsWith(const std::string& value,const char* suffix){
    const std::string tail(suffix);return value.size()>=tail.size()&&value.compare(value.size()-tail.size(),tail.size(),tail)==0;
}
bool simplifiedChinese(const std::string& family){return endsWith(family," SC")||family.rfind("ST",0)==0||family=="Hiragino Sans GB";}
bool traditionalChinese(const std::string& family){return endsWith(family," TC")||family=="LiSong Pro"||family=="LiHei Pro";}
bool serifFamily(const std::string& family){
    for(const char* part:{"Mincho","明朝","Song","宋","Serif","Times","Ming"})if(family.find(part)!=std::string::npos)return true;
    return false;
}

struct CellMetrics {double ascent,descent;};
// usWinAscent/usWinDescent per em of the Windows faces that Windows-authored
// GDI size tables are calibrated against; a substitute face keeps the em size.
std::optional<CellMetrics> windowsCellMetrics(const std::string& family){
    static const std::map<std::string,CellMetrics> table=[]{
        std::map<std::string,CellMetrics> result;
        for(const char* name:{"Meiryo","メイリオ"})result.emplace(name,CellMetrics{2171.0/2048,901.0/2048});
        for(const char* name:{"MS Gothic","MS PGothic","MS UI Gothic","ＭＳ ゴシック","ＭＳ Ｐゴシック","MS Mincho","MS PMincho","ＭＳ 明朝","ＭＳ Ｐ明朝",
            "SimSun","NSimSun","宋体","新宋体"})result.emplace(name,CellMetrics{220.0/256,36.0/256});
        return result;
    }();
    const auto found=table.find(family);
    return found==table.end()?std::nullopt:std::optional<CellMetrics>(found->second);
}

// GDI's font mapper weighs the requested character set above the face name.
// Chinese text requested in a Japanese face is drawn by the Chinese face of
// the same style, so simplified and traditional glyph forms stay correct.
std::string bitmapFamily(const BitmapTextOptions& options){
    const auto requested=macos::resolveFamily(options.fontFamily);
    const bool serif=serifFamily(options.fontFamily);
    if(options.charSet==gb2312CharSet&&!(requested&&simplifiedChinese(*requested)))
        if(auto family=serif?macos::firstInstalled({"Songti SC","STSong"}):macos::firstInstalled({"PingFang SC","Hiragino Sans GB","Heiti SC"}))return *family;
    if(options.charSet==big5CharSet&&!(requested&&traditionalChinese(*requested)))
        if(auto family=serif?macos::firstInstalled({"Songti TC"}):macos::firstInstalled({"PingFang TC","Heiti TC"}))return *family;
    if(requested)return *requested;
    if(!options.allowFontSubstitution)throw std::runtime_error("System font family is unavailable: "+options.fontFamily);
    const auto substitute=options.charSet==shiftJisCharSet?macos::firstInstalled({"Hiragino Kaku Gothic ProN","Hiragino Sans"}):macos::firstInstalled({"Arial","Helvetica"});
    if(!substitute)throw std::runtime_error("No substitute system font is available");
    return *substitute;
}
std::string charSetLanguage(std::uint32_t charSet){
    return charSet==gb2312CharSet?"zh-Hans":charSet==big5CharSet?"zh-Hant":charSet==shiftJisCharSet?"ja":"";
}

struct GdiFont {
    CF<CTFontRef> font;
    int ascent=0,height=0;
    bool emboldened=false;
    std::string language;
};
// A positive GDI height selects the cell height (usWinAscent + usWinDescent),
// a negative one the em height.
GdiFont gdiFont(const BitmapTextOptions& options){
    constexpr double reference=1000;
    auto font=macos::createFont(bitmapFamily(options),reference);
    GdiFont result;result.language=charSetLanguage(options.charSet);
    if(options.fontWeight>=600){
        CF<CTFontRef> bold(CTFontCreateCopyWithSymbolicTraits(font.get(),0,nullptr,kCTFontTraitBold,kCTFontTraitBold));
        if(bold)font=std::move(bold);else result.emboldened=true;
    }
    auto cell=windowsCellMetrics(options.fontFamily);
    if(!cell){
        const double units=CTFontGetUnitsPerEm(font.get());
        cell=CellMetrics{CTFontGetAscent(font.get())/reference,CTFontGetDescent(font.get())/reference};
        CF<CFDataRef> metrics(CTFontCopyTable(font.get(),kCTFontTableOS2,kCTFontTableOptionNoOptions));
        if(metrics&&CFDataGetLength(metrics.get())>=78){
            const auto* bytes=CFDataGetBytePtr(metrics.get());
            const double winAscent=(bytes[74]<<8)|bytes[75],winDescent=(bytes[76]<<8)|bytes[77];
            if(winAscent+winDescent>0)cell=CellMetrics{winAscent/units,winDescent/units};
        }
    }
    const double em=options.fontSize>0?options.fontSize/(cell->ascent+cell->descent):-static_cast<double>(options.fontSize);
    result.font.reset(CTFontCreateCopyWithAttributes(font.get(),em,nullptr,nullptr));
    if(!result.font)throw std::runtime_error("Cannot create bitmap text font");
    result.ascent=static_cast<int>(std::lround(cell->ascent*em));
    result.height=result.ascent+static_cast<int>(std::lround(cell->descent*em));
    return result;
}

// Glyphs advance by whole pixels without kerning, as GDI TextOut does. Returns
// the advance; draws into the coverage mask when one is supplied.
int drawText(CGContextRef mask,int rows,const GdiFont& font,CFStringRef text,int x,int y){
    const auto attributed=macos::attributedText(text,font.font.get(),font.language);
    CF<CTLineRef> line(CTLineCreateWithAttributedString(attributed.get()));
    if(!line)throw std::runtime_error("Cannot shape bitmap text");
    const auto runs=CTLineGetGlyphRuns(line.get());int pen=x;
    for(CFIndex index=0,runCount=CFArrayGetCount(runs);index<runCount;++index){
        const auto run=static_cast<CTRunRef>(CFArrayGetValueAtIndex(runs,index));
        const auto count=CTRunGetGlyphCount(run);if(count<1)continue;
        const auto runFont=static_cast<CTFontRef>(CFDictionaryGetValue(CTRunGetAttributes(run),kCTFontAttributeName));
        const bool embolden=font.emboldened&&!(CTFontGetSymbolicTraits(runFont)&kCTFontTraitBold);
        std::vector<CGGlyph> glyphs(static_cast<std::size_t>(count));std::vector<CGSize> advances(glyphs.size());std::vector<CGPoint> positions(glyphs.size());
        CTRunGetGlyphs(run,CFRangeMake(0,0),glyphs.data());CTRunGetAdvances(run,CFRangeMake(0,0),advances.data());
        for(std::size_t i=0;i<glyphs.size();++i){
            positions[i]=CGPointMake(pen,rows-(y+font.ascent));
            pen+=static_cast<int>(std::lround(advances[i].width))+(embolden?1:0);
        }
        if(!mask)continue;
        CTFontDrawGlyphs(runFont,glyphs.data(),positions.data(),glyphs.size(),mask);
        if(embolden){
            for(auto& position:positions)position.x+=1;
            CTFontDrawGlyphs(runFont,glyphs.data(),positions.data(),glyphs.size(),mask);
        }
    }
    return pen-x;
}
}

bool platformHasSystemFont(const std::string& family){
    const auto name=macos::cfString(family);const auto length=CFStringGetLength(name.get());
    if(length<1||length>=32)throw std::runtime_error("System font family must contain 1..31 UTF-16 units");
    return macos::resolveFamily(family).has_value();
}
std::vector<std::uint8_t> platformEncodeText(const std::string& text,std::uint32_t codePage){
    const auto encoding=codePageEncoding(codePage);
    return encode(macos::cfString(text).get(),encoding);
}
BitmapTextPixels platformRasterizeBitmapText(const std::string& text,const BitmapTextOptions& options){
    if(options.width<1||options.height<1||options.width>4096||options.height>4096)throw std::runtime_error("Bitmap text dimensions must be in 1..4096");
    if(!options.allowFontSubstitution&&!platformHasSystemFont(options.fontFamily))throw std::runtime_error("System font family is unavailable: "+options.fontFamily);
    const auto encoding=codePageEncoding(options.codePage);
    const auto encoded=encode(macos::cfString(text).get(),encoding);
    CF<CFStringRef> content(CFStringCreateWithBytes(nullptr,encoded.data(),static_cast<CFIndex>(encoded.size()),encoding,false));
    if(!content)throw std::runtime_error("Cannot decode text with code page "+std::to_string(options.codePage));
    // Like the GDI DIB, the surface has one spare row below the visible pixels.
    const auto width=static_cast<std::size_t>(options.width),rows=static_cast<std::size_t>(options.height)+1;
    std::vector<std::uint8_t> surface(width*rows*4);
    for(std::size_t offset=0;offset<surface.size();offset+=4){
        surface[offset]=static_cast<std::uint8_t>(options.background>>24);surface[offset+1]=static_cast<std::uint8_t>(options.background>>16);
        surface[offset+2]=static_cast<std::uint8_t>(options.background>>8);surface[offset+3]=static_cast<std::uint8_t>(options.background);
    }
    if(!options.pixels.empty()){
        if(options.pixels.size()!=width*options.height*4)throw std::runtime_error("Bitmap initial pixels require exactly width*height*4 RGBA bytes");
        std::copy(options.pixels.begin(),options.pixels.end(),surface.begin());
    }
    const auto font=gdiFont(options);
    std::vector<std::uint8_t> coverage(width*rows);
    CF<CGContextRef> mask(CGBitmapContextCreate(coverage.data(),width,rows,8,width,nullptr,kCGImageAlphaOnly));
    if(!mask)throw std::runtime_error("Cannot allocate bitmap text coverage");
    CGContextSetShouldAntialias(mask.get(),options.quality!=nonantialiasedQuality);
    CGContextSetAllowsFontSmoothing(mask.get(),false);
    CGContextSetAllowsFontSubpixelPositioning(mask.get(),false);
    CGContextSetAllowsFontSubpixelQuantization(mask.get(),false);
    CGContextSetTextMatrix(mask.get(),CGAffineTransformIdentity);
    CGContextSetGrayFillColor(mask.get(),0,1);
    const auto length=CFStringGetLength(content.get());
    const auto extent=drawText(nullptr,static_cast<int>(rows),font,content.get(),0,0);
    if(!options.spacing)drawText(mask.get(),static_cast<int>(rows),font,content.get(),options.x,options.y);
    else for(CFIndex i=0;i<length;++i){
        CF<CFStringRef> unit(CFStringCreateWithSubstring(nullptr,content.get(),CFRangeMake(i,1)));
        drawText(mask.get(),static_cast<int>(rows),font,unit.get(),options.x+static_cast<int>(i)*options.spacing,options.y);
    }
    // GDI writes glyph colour blended over the surface and clears alpha on every pixel it touches.
    const unsigned red=options.fill>>24,green=(options.fill>>16)&255,blue=(options.fill>>8)&255;
    for(std::size_t i=0;i<coverage.size();++i){
        const unsigned c=coverage[i];if(!c)continue;
        auto* pixel=surface.data()+i*4;
        pixel[0]=static_cast<std::uint8_t>((pixel[0]*(255u-c)+red*c+127u)/255u);
        pixel[1]=static_cast<std::uint8_t>((pixel[1]*(255u-c)+green*c+127u)/255u);
        pixel[2]=static_cast<std::uint8_t>((pixel[2]*(255u-c)+blue*c+127u)/255u);
        pixel[3]=0;
    }
    BitmapTextPixels result;result.width=options.width;result.height=options.height;result.extentWidth=extent;result.extentHeight=font.height;
    result.pixels.assign(surface.begin(),surface.begin()+static_cast<std::ptrdiff_t>(width*options.height*4));
    return result;
}
}
