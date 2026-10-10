#pragma once
#include <CoreFoundation/CoreFoundation.h>
#include <CoreGraphics/CoreGraphics.h>
#include <CoreText/CoreText.h>
#include <map>
#include <optional>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>

namespace tsstg::macos {
template<class T> class CF final {
public:
    CF()=default;
    explicit CF(T value):value_(value){}
    CF(const CF&)=delete;
    CF& operator=(const CF&)=delete;
    CF(CF&& other) noexcept:value_(std::exchange(other.value_,nullptr)){}
    CF& operator=(CF&& other) noexcept {if(this!=&other){reset();value_=std::exchange(other.value_,nullptr);}return *this;}
    ~CF(){reset();}
    T get() const {return value_;}
    explicit operator bool() const {return value_!=nullptr;}
    void reset(T value=nullptr){if(value_)CFRelease(value_);value_=value;}
private:
    T value_=nullptr;
};

inline CF<CFStringRef> cfString(const std::string& text){
    CF<CFStringRef> value(CFStringCreateWithBytes(nullptr,reinterpret_cast<const UInt8*>(text.data()),static_cast<CFIndex>(text.size()),kCFStringEncodingUTF8,false));
    if(!value)throw std::runtime_error("Invalid UTF-8 text");
    return value;
}

inline bool familyInstalled(const std::string& family){
    static std::map<std::string,bool> cache;
    if(const auto found=cache.find(family);found!=cache.end())return found->second;
    const auto name=cfString(family);
    const void* keys[]={kCTFontFamilyNameAttribute};const void* values[]={name.get()};
    CF<CFDictionaryRef> attributes(CFDictionaryCreate(nullptr,keys,values,1,&kCFTypeDictionaryKeyCallBacks,&kCFTypeDictionaryValueCallBacks));
    CF<CTFontDescriptorRef> descriptor(CTFontDescriptorCreateWithAttributes(attributes.get()));
    const void* mandatory[]={kCTFontFamilyNameAttribute};
    CF<CFSetRef> required(CFSetCreate(nullptr,mandatory,1,&kCFTypeSetCallBacks));
    CF<CFArrayRef> matches(CTFontDescriptorCreateMatchingFontDescriptors(descriptor.get(),required.get()));
    return cache[family]=matches&&CFArrayGetCount(matches.get())>0;
}

// Windows family names (English and localized) used by Windows-authored
// content, mapped to macOS system families with matching script and style.
inline const std::vector<std::string>* windowsFamilyAlias(const std::string& family){
    static const std::map<std::string,std::vector<std::string>> aliases=[]{
        std::map<std::string,std::vector<std::string>> table;
        const auto add=[&](std::initializer_list<const char*> names,std::vector<std::string> mac){for(const auto* name:names)table.emplace(name,mac);};
        add({"Microsoft YaHei","Microsoft YaHei UI","微软雅黑","DengXian","等线"},{"PingFang SC","Hiragino Sans GB","Heiti SC"});
        add({"Microsoft JhengHei","Microsoft JhengHei UI","微軟正黑體"},{"PingFang TC","Heiti TC"});
        add({"SimSun","NSimSun","宋体","新宋体"},{"Songti SC","STSong"});
        add({"SimHei","黑体"},{"Heiti SC","PingFang SC"});
        add({"KaiTi","楷体","KaiTi_GB2312"},{"Kaiti SC","STKaiti"});
        add({"FangSong","仿宋"},{"STFangsong","Songti SC"});
        add({"MingLiU","PMingLiU","細明體","新細明體"},{"Songti TC","LiSong Pro"});
        add({"Yu Gothic","Yu Gothic UI","游ゴシック"},{"YuGothic","Hiragino Sans"});
        add({"Yu Mincho","游明朝"},{"YuMincho","Hiragino Mincho ProN"});
        add({"Meiryo","Meiryo UI","メイリオ"},{"Hiragino Sans","Hiragino Kaku Gothic ProN"});
        add({"MS Gothic","MS PGothic","MS UI Gothic","ＭＳ ゴシック","ＭＳ Ｐゴシック"},{"Hiragino Kaku Gothic ProN","Hiragino Sans"});
        add({"MS Mincho","MS PMincho","ＭＳ 明朝","ＭＳ Ｐ明朝"},{"Hiragino Mincho ProN","YuMincho"});
        add({"Segoe UI","Tahoma","Verdana"},{"Helvetica Neue","Helvetica"});
        add({"Consolas","Courier New"},{"Menlo","Courier New"});
        return table;
    }();
    const auto found=aliases.find(family);
    return found==aliases.end()?nullptr:&found->second;
}

// The installed macOS family that renders a requested system family.
inline std::optional<std::string> resolveFamily(const std::string& family){
    if(familyInstalled(family))return family;
    if(const auto* alias=windowsFamilyAlias(family))for(const auto& candidate:*alias)if(familyInstalled(candidate))return candidate;
    return std::nullopt;
}

inline std::optional<std::string> firstInstalled(std::initializer_list<const char*> families){
    for(const auto* family:families)if(familyInstalled(family))return std::string(family);
    return std::nullopt;
}

inline CF<CTFontRef> createFont(const std::string& family,double size){
    const auto name=cfString(family);
    const void* keys[]={kCTFontFamilyNameAttribute};const void* values[]={name.get()};
    CF<CFDictionaryRef> attributes(CFDictionaryCreate(nullptr,keys,values,1,&kCFTypeDictionaryKeyCallBacks,&kCFTypeDictionaryValueCallBacks));
    CF<CTFontDescriptorRef> descriptor(CTFontDescriptorCreateWithAttributes(attributes.get()));
    CF<CTFontRef> font(CTFontCreateWithFontDescriptor(descriptor.get(),size,nullptr));
    if(!font)throw std::runtime_error("Cannot create system font: "+family);
    return font;
}

// CoreText language tags select CJK glyph forms and fallback fonts.
inline std::string languageTag(const std::string& locale){
    std::string lower;for(const char c:locale)lower.push_back(c=='_'?'-':static_cast<char>(c>='A'&&c<='Z'?c-'A'+'a':c));
    if(lower=="zh-tw"||lower=="zh-hk"||lower=="zh-mo"||lower.rfind("zh-hant",0)==0)return "zh-Hant";
    if(lower.rfind("zh",0)==0)return "zh-Hans";
    const auto dash=lower.find('-');
    return dash==std::string::npos?lower:lower.substr(0,dash);
}

inline CF<CFAttributedStringRef> attributedText(CFStringRef text,CTFontRef font,const std::string& language){
    const auto tag=cfString(language);
    const void* keys[]={kCTFontAttributeName,kCTLanguageAttributeName};
    const void* values[]={font,tag.get()};
    CF<CFDictionaryRef> attributes(CFDictionaryCreate(nullptr,keys,values,language.empty()?1:2,&kCFTypeDictionaryKeyCallBacks,&kCFTypeDictionaryValueCallBacks));
    CF<CFAttributedStringRef> result(CFAttributedStringCreate(nullptr,text,attributes.get()));
    if(!result)throw std::runtime_error("Cannot create attributed text");
    return result;
}
}
