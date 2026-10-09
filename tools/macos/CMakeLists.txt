cmake_minimum_required(VERSION 3.24)
set(CMAKE_OSX_DEPLOYMENT_TARGET "11.0" CACHE STRING "Minimum macOS version")
project(Touhou21MacHost LANGUAGES C CXX)

if(NOT APPLE)
  message(FATAL_ERROR "This build supplies the macOS text services of the TS-STG host.")
endif()
set(TSSTG_SOURCE_DIR "" CACHE PATH "TS-STG source tree at the commit pinned by engine.lock.json")
if(NOT EXISTS "${TSSTG_SOURCE_DIR}/native/src/host.cpp")
  message(FATAL_ERROR "TSSTG_SOURCE_DIR must name the locked TS-STG source tree.")
endif()

# The pinned V8 SDK is Windows-only; macOS uses the engine's QuickJS-NG backend.
set(TSSTG_ENABLE_V8 OFF CACHE BOOL "" FORCE)
set(BUILD_TESTING OFF CACHE BOOL "" FORCE)
add_subdirectory("${TSSTG_SOURCE_DIR}" engine)

get_target_property(engine_sources ts-stg SOURCES)
list(FILTER engine_sources EXCLUDE REGEX "text_(win32|gdi)\\.cpp$")
list(TRANSFORM engine_sources PREPEND "${TSSTG_SOURCE_DIR}/")
set_property(TARGET ts-stg PROPERTY SOURCES ${engine_sources}
  "${CMAKE_CURRENT_SOURCE_DIR}/text_coretext.cpp"
  "${CMAKE_CURRENT_SOURCE_DIR}/text_bitmap_coretext.cpp")
target_include_directories(ts-stg PRIVATE "${CMAKE_CURRENT_SOURCE_DIR}")
target_link_libraries(ts-stg PRIVATE "-framework CoreText" "-framework CoreGraphics" "-framework CoreFoundation")
