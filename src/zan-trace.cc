#include <map>
#include <string>
#include <set>
#include <stack>
#include <iostream>

#include <node.h>
#include <v8-profiler.h>

namespace gcstats {

using namespace v8;
using namespace std;

// totalPhysicalSize, totalHeapSize相等
// totalHeapSize与memoryUsage的heapTotal相等
// sedHeapSize与memoryUsage的heapUsed相等
struct HeapInfo {
  size_t doesZapGarbage;
  size_t heapSizeLimit;
  size_t totalAvailableSize;
  size_t totalHeapSize;
  size_t totalHeapSizeExecutable;
  size_t totalPhysicalSize;
  size_t usedHeapSize;
};

// physicalSpaceSize, heapSizeLimit, spaceSize相等
// spaceAvailableSize, spaceUsedSize互补
struct HeapSpaceInfo {
  size_t physicalSpaceSize;
  size_t spaceAvailableSize;
  const char* spaceName;
  size_t spaceSize;
  size_t spaceUsedSize;
};

HeapStatistics stats;
HeapSpaceStatistics spaceStats;

void copyHeapStats(HeapStatistics* stats, HeapInfo* info) {
  info->doesZapGarbage = stats->does_zap_garbage();
  info->heapSizeLimit = stats->heap_size_limit();
  info->totalAvailableSize = stats->total_available_size();
  info->totalHeapSize = stats->total_heap_size();
  info->totalHeapSizeExecutable = stats->total_heap_size_executable();
  info->totalPhysicalSize = stats->total_physical_size();
  info->usedHeapSize = stats->used_heap_size();
}

void copyHeapSpaceStats(HeapSpaceStatistics* spaceStats, HeapSpaceInfo* info) {
  info->physicalSpaceSize = spaceStats->physical_space_size();
  info->spaceAvailableSize = spaceStats->space_available_size();
  info->spaceName = spaceStats->space_name();
  info->spaceSize = spaceStats->space_size();
  info->spaceUsedSize = spaceStats->space_used_size();
}

void GcStatsMethod(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  size_t spacesCount = isolate->NumberOfHeapSpaces();

  isolate->GetHeapStatistics(&stats);

  Local<Object> obj = Object::New(isolate);
  Local<Array> spacesArr = Array::New(isolate, spacesCount);

  for (size_t i = 0; i < spacesCount; i++) {
    Local<Object> spaceObj = Object::New(isolate);
    isolate->GetHeapSpaceStatistics(&spaceStats, i);

    spaceObj->Set(String::NewFromUtf8(isolate, "physicalSpaceSize"),
                  Number::New(isolate, spaceStats.physical_space_size()));
    spaceObj->Set(String::NewFromUtf8(isolate, "spaceAvailableSize"),
                  Number::New(isolate, spaceStats.space_available_size()));
    spaceObj->Set(String::NewFromUtf8(isolate, "spaceName"),
                  String::NewFromUtf8(isolate, spaceStats.space_name()));
    spaceObj->Set(String::NewFromUtf8(isolate, "spaceSize"),
                  Number::New(isolate, spaceStats.space_size()));
    spaceObj->Set(String::NewFromUtf8(isolate, "spaceUsedSize"),
                  Number::New(isolate, spaceStats.space_used_size()));
    spacesArr->Set(i, spaceObj);
  }

  obj->Set(String::NewFromUtf8(isolate, "doesZapGarbage"),
           Number::New(isolate, stats.does_zap_garbage()));
  obj->Set(String::NewFromUtf8(isolate, "heapSizeLimit"),
           Number::New(isolate, stats.heap_size_limit()));
  obj->Set(String::NewFromUtf8(isolate, "totalAvailableSize"),
           Number::New(isolate, stats.total_available_size()));
  obj->Set(String::NewFromUtf8(isolate, "totalHeapSize"),
           Number::New(isolate, stats.total_heap_size()));
  obj->Set(String::NewFromUtf8(isolate, "totalHeapSizeExecutable"),
           Number::New(isolate, stats.total_heap_size_executable()));
  obj->Set(String::NewFromUtf8(isolate, "totalPhysicalSize"),
           Number::New(isolate, stats.total_physical_size()));
  obj->Set(String::NewFromUtf8(isolate, "usedHeapSize"),
           Number::New(isolate, stats.used_heap_size()));
  obj->Set(String::NewFromUtf8(isolate, "spaces"), spacesArr);

  args.GetReturnValue().Set(obj);
}

string handleToStr(const Handle<Value>& str) {
  String::Utf8Value utfString(str->ToString());
  return *utfString;
}

void buildIDSet(set<uint64_t>* seen, const HeapGraphNode* cur) {
  stack<const HeapGraphNode*> dfs;
  dfs.push(cur);

  do {
    const HeapGraphNode* top = dfs.top();
    dfs.pop();

//    if (top->GetType() == HeapGraphNode::kObject) {
//        cout << "Object Name:" << handleToStr(top->GetName()) << endl;
//    }

    // cycle detection
    if (seen->find(top->GetId()) != seen->end()) {
      continue;
    }
    seen->insert(top->GetId());

    for (int i = 0, l = top->GetChildrenCount(); i < l; i++) {
      dfs.push(top->GetChild(i)->GetToNode());
    }
  } while (!dfs.empty());
}

const char* getTypeName(const HeapGraphNode* node) {
  std::string type;

//  enum Type {
//    kHidden = 0, kArray = 1, kString = 2, kObject = 3,
//    kCode = 4, kClosure = 5, kRegExp = 6, kHeapNumber = 7,
//    kNative = 8, kSynthetic = 9, kConsString = 10, kSlicedString = 11,
//    kSymbol = 12, kSimdValue = 13
//  }

  switch(node->GetType()) {
    case HeapGraphNode::kArray:
      type.append("Array");
      break;
    case HeapGraphNode::kString:
      type.append("String");
      break;
    case HeapGraphNode::kObject:
      type.append(handleToStr(node->GetName()));
      break;
    case HeapGraphNode::kCode:
      type.append("Code");
      break;
    case HeapGraphNode::kClosure:
      type.append("Closure");
      break;
    case HeapGraphNode::kRegExp:
      type.append("RegExp");
      break;
    case HeapGraphNode::kHeapNumber:
      type.append("Number");
      break;
    case HeapGraphNode::kSynthetic:
      type.append("Synthetic");
      break;
    case HeapGraphNode::kConsString:
      type.append("ConsString");
      break;
    case HeapGraphNode::kSlicedString:
      type.append("SlicedString");
      break;
    case HeapGraphNode::kSymbol:
      type.append("Symbol");
      break;
    case HeapGraphNode::kSimdValue:
      type.append("SimdValue");
      break;
    case HeapGraphNode::kNative:
      type.append("Native");
      break;
    case HeapGraphNode::kHidden:
      type.append("Hidden");
      break;
    default:
      type.append("Unknow");
  }

  return type.c_str();
}

void HeapStatsMethod(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();

  HeapProfiler* profiler = isolate->GetHeapProfiler();
  const HeapSnapshot* heapSnapshot = profiler->TakeHeapSnapshot(NULL);

  Local<Object> obj = Object::New(isolate);
  set<uint64_t> heapIdSet;

  buildIDSet(&heapIdSet, heapSnapshot->GetRoot());
  std::set<uint64_t>::iterator it;

  for (it = heapIdSet.begin(); it != heapIdSet.end(); ++it) {
    uint64_t nodeId = *it;
    const HeapGraphNode * n = heapSnapshot->GetNodeById(nodeId);

    Local<String> key = String::NewFromUtf8(isolate, getTypeName(n));
    Local<Number> size = Number::New(isolate, n->GetShallowSize());

    if (obj->Has(key)) {
      obj->Set(key, Number::New(isolate, obj->Get(key)->NumberValue() + size->NumberValue()));
    } else {
      obj->Set(key, size);
    }
  }

  ((HeapSnapshot *)heapSnapshot)->Delete();
  args.GetReturnValue().Set(obj);
}

void init(Local<Object> exports) {
  NODE_SET_METHOD(exports, "gcstats", GcStatsMethod);
  NODE_SET_METHOD(exports, "heapstats", HeapStatsMethod);
}

NODE_MODULE(gcstats, init)

}

