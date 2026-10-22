// ── Minimal Figma sandbox mock, enough to exercise the token reuse logic ──
var _id = 0; function nid(p){ return p + (++_id); }
function F(){ return {
  mixed: Symbol('mixed'),
  _paintStyles: [], _textStyles: [], _vars: [], _cols: [], _nodes: {}, _gridStyles: [],
  showUI: function(){}, on: function(){}, commitUndo: function(){},
  notify: function(){},
  ui: { postMessage: function(m){ (globalThis.__posted = globalThis.__posted || []).push(m); }, resize: function(){}, onmessage: null },
  currentPage: { id:'p1', type:'PAGE', selection: [], children: [],
    appendChild: function(c){
      if (c.parent && c.parent.children) {
        var j = c.parent.children.indexOf(c); if (j >= 0) c.parent.children.splice(j,1);
      }
      c.parent = this; this.children.push(c);
    },
    findOne: function(pred){
      var stack = (this.children || []).slice();
      while (stack.length) {
        var n = stack.shift();
        if (pred(n)) return n;
        if (n.children) Array.prototype.push.apply(stack, n.children);
      }
      return null;
    } },
  loadFontAsync: function(f){
    if (figma._fonts && figma._fonts.indexOf(f.family + '|' + f.style) === -1) {
      return Promise.reject(new Error('Font not available: ' + f.family + ' ' + f.style));
    }
    return Promise.resolve();
  },
  listAvailableFontsAsync: function(){
    return Promise.resolve((figma._fonts || []).map(function(k){
      var p = k.split('|'); return { fontName: { family: p[0], style: p[1] } };
    }));
  },
  viewport: { scrollAndZoomIntoView: function(){} },
  createFrame: function(){ return mkFrame({}); },
  createText: function(){ var t = mkText(''); t.textAutoResize = 'NONE'; t.fontSize = 12;
                          t.fontName = { family:'Inter', style:'Regular' }; return t; },
  createComponent: function(){ var c = mkFrame({}); c.type = 'COMPONENT'; return c; },
  createRectangle: function(){ var r = mkFrame({}); r.type = 'RECTANGLE'; delete r.children; r.strokeWeight = 0; r.opacity = 1; return r; },
  combineAsVariants: function(nodes, parent){
    var set = mkFrame({ name: 'Component Set' });
    set.type = 'COMPONENT_SET';
    for (var i = 0; i < nodes.length; i++) set.appendChild(nodes[i]);
    if (parent && parent.appendChild) parent.appendChild(set);
    return set;
  },
  getLocalPaintStylesAsync: function(){ return Promise.resolve(this._paintStyles.slice()); },
  getLocalTextStylesAsync: function(){ return Promise.resolve(this._textStyles.slice()); },
  getLocalGridStylesAsync: function(){ return Promise.resolve((figma._gridStyles || []).slice()); },
  createGridStyle: function(){
    var st = { id: nid('G'), name: '', layoutGrids: [],
      remove: function(){ var i = figma._gridStyles.indexOf(this); if (i>=0) figma._gridStyles.splice(i,1); } };
    figma._gridStyles = figma._gridStyles || [];
    figma._gridStyles.push(st);
    return st;
  },
  getStyleByIdAsync: function(){ return Promise.resolve(null); },
  getNodeByIdAsync: function(id){ return Promise.resolve(figma._nodes[id] || null); },
  createPaintStyle: function(){ var st={id:nid('S'),name:'',paints:[],
      remove:function(){ var i=figma._paintStyles.indexOf(this); if(i>=0) figma._paintStyles.splice(i,1); }};
    this._paintStyles.push(st); return st; },
  createTextStyle: function(){ var st={id:nid('T'),name:'',fontName:{family:'',style:''},fontSize:0,
      lineHeight:{unit:'AUTO'},letterSpacing:{unit:'PERCENT',value:0},boundVars:{},
      setBoundVariable:function(f,v){ this.boundVars[f]=v.id; },
      remove:function(){ var i=figma._textStyles.indexOf(this); if(i>=0) figma._textStyles.splice(i,1); }};
    this._textStyles.push(st); return st; },
  variables: {
    getLocalVariableCollectionsAsync: function(){ return Promise.resolve(figma._cols.slice()); },
    createVariableCollection: function(name){
      var c = { id:nid('C'), name:name, modes:[], defaultModeId:null,
        // The real API throws once the plan's ceiling is reached. figma._modeCap
        // makes that ceiling settable so a test can exercise both outcomes.
        addMode: function(mname){
          if (this.modes.length >= (figma._modeCap == null ? 4 : figma._modeCap)) {
            throw new Error('Limited to ' + (figma._modeCap == null ? 4 : figma._modeCap) + ' modes');
          }
          var id = nid('m'); this.modes.push({ modeId:id, name:mname });
          if (!this.defaultModeId) this.defaultModeId = id;
          return id;
        },
        renameMode: function(mid, mname){
          for (var i=0;i<this.modes.length;i++) if (this.modes[i].modeId===mid) { this.modes[i].name = mname; return; }
          throw new Error('No such mode');
        },
        removeMode: function(mid){
          if (this.modes.length <= 1) throw new Error('A collection needs at least one mode');
          for (var i=0;i<this.modes.length;i++) if (this.modes[i].modeId===mid) {
            this.modes.splice(i,1);
            if (this.defaultModeId===mid) this.defaultModeId = this.modes[0].modeId;
            return;
          }
          throw new Error('No such mode');
        }
      };
      c.addMode('Mode 1');
      figma._cols.push(c); return c; },
    createVariableAlias: function(v){ return { type:'VARIABLE_ALIAS', id:v.id }; },
    createVariable: function(name, col, type){
      if (!col || !col.id) throw new Error('createVariable needs a collection OBJECT');
      var v={id:nid('V'),name:name,variableCollectionId:col.id,resolvedType:type,valuesByMode:{},scopes:[],remote:false,
             setValueForMode:function(m,val){ this.valuesByMode[m]=val; },
             remove:function(){ var i=figma._vars.indexOf(this); if(i>=0) figma._vars.splice(i,1); }};
      figma._vars.push(v); return v; },
    getVariableByIdAsync: function(id){ return Promise.resolve(figma._vars.filter(function(v){return v.id===id;})[0]||null); },
    getVariableCollectionByIdAsync: function(id){ return Promise.resolve(figma._cols.filter(function(c){return c.id===id;})[0]||null); },
    getLocalVariablesAsync: function(type){ return Promise.resolve(figma._vars.filter(function(v){ return !type || v.resolvedType===type; })); },
    setBoundVariableForPaint: function(paint, field, v){ var p=JSON.parse(JSON.stringify(paint)); p.boundVariables={};
      p.boundVariables[field]={type:'VARIABLE_ALIAS',id:v.id};
      // MEASURED IN FIGMA: the variable's alpha overwrites paint.opacity on write.
      var val=null; for (var i=0;i<figma._vars.length;i++) if (figma._vars[i].id===v.id) val=v.valuesByMode[Object.keys(v.valuesByMode)[0]];
      if (val && typeof val.a==='number') p.opacity = val.a;
      return p; }
  }
}; }
function resetFigma(){
  globalThis.figma = F();
  figma._modeCap = 4;
  figma.root = { id:'root', children: [], _plugin: {},
    setPluginData: function(k,v){ this._plugin[k]=String(v); },
    getPluginData: function(k){ return this._plugin[k]||''; } };
  return figma;
}
globalThis.resetFigma = resetFigma;
resetFigma();

// ── Node factory, enough to exercise binding and breakpoint preview ────────
// Only what the UI Kit code touches: auto-layout fields, bindable numeric
// fields, explicit mode overrides, and plugin data.
function mkFrame(o){
  o = o || {};
  var n = {
    id: nid('N'), type: 'FRAME', name: o.name || 'Frame', visible: true, locked: false,
    children: o.children || [], parent: null,
    layoutMode: o.layoutMode || 'NONE', layoutWrap: o.layoutWrap || 'NO_WRAP',
    layoutSizingHorizontal: o.layoutSizingHorizontal || 'FIXED',
    layoutSizingVertical: o.layoutSizingVertical || 'FIXED',
    primaryAxisSizingMode: 'FIXED', counterAxisSizingMode: 'FIXED',
    width: o.width == null ? 100 : o.width, height: o.height == null ? 100 : o.height,
    minWidth: null, maxWidth: null,
    paddingLeft: o.paddingLeft || 0, paddingRight: o.paddingRight || 0,
    paddingTop: o.paddingTop || 0, paddingBottom: o.paddingBottom || 0,
    itemSpacing: o.itemSpacing || 0, counterAxisSpacing: o.counterAxisSpacing || 0,
    cornerRadius: o.cornerRadius || 0,
    fills: [], strokes: [],
    boundVariables: {}, explicitVariableModes: {}, _plugin: {},
    setBoundVariable: function(field, v){
      if (v === null) { delete this.boundVariables[field]; return; }
      if (!v || !v.id) throw new Error('setBoundVariable needs a variable');
      this.boundVariables[field] = { type:'VARIABLE_ALIAS', id: v.id };
    },
    setExplicitVariableModeForCollection: function(col, modeId){
      if (!col || !col.id) throw new Error('Pass the collection OBJECT, not its id');
      var ok = (col.modes||[]).some(function(m){ return m.modeId === modeId; });
      if (!ok) throw new Error('That mode is not in that collection');
      this.explicitVariableModes[col.id] = modeId;
    },
    clearExplicitVariableModeForCollection: function(col){ delete this.explicitVariableModes[col.id]; },
    // The real property folds in modes inherited from ancestors. Without
    // that, a child of a mode-overridden frame resolves to the wrong mode
    // and the tests would never notice.
    get resolvedVariableModes(){
      var out = {}, chain = [], at = this;
      while (at && at.type !== 'PAGE') { chain.unshift(at); at = at.parent; }
      for (var i = 0; i < chain.length; i++) {
        var ex = chain[i].explicitVariableModes || {};
        for (var k in ex) out[k] = ex[k];
      }
      return out;
    },
    setPluginData: function(k, val){ this._plugin[k] = String(val); },
    getPluginData: function(k){ return this._plugin[k] || ''; },
    appendChild: function(c){
      if (c.parent && c.parent.children) {
        var j = c.parent.children.indexOf(c); if (j >= 0) c.parent.children.splice(j,1);
      }
      c.parent = this; this.children.push(c);
    },
    insertChild: function(idx, c){
      if (c.parent && c.parent.children) {
        var j = c.parent.children.indexOf(c); if (j >= 0) c.parent.children.splice(j,1);
      }
      c.parent = this; this.children.splice(idx, 0, c);
    },
    remove: function(){
      this.removed = true;
      if (this.parent && this.parent.children) {
        var j = this.parent.children.indexOf(this); if (j >= 0) this.parent.children.splice(j,1);
      }
    },
    // The real resize() RESETS both sizing modes to FIXED. Code that sets
    // AUTO/HUG and then resizes ends up FIXED at the resized value — which
    // is how a section ends up 1px tall. Model it, or the tests lie.
    resize: function(w,h){
      this.width = w; this.height = h;
      this.primaryAxisSizingMode = 'FIXED';
      this.counterAxisSizingMode = 'FIXED';
      try { this.layoutSizingHorizontal = 'FIXED'; this.layoutSizingVertical = 'FIXED'; } catch (e) {}
    },
    clone: function(){ return cloneNode(this); },
    createInstance: function(){
      var inst = cloneNode(this);
      inst.type = 'INSTANCE';
      inst.name = this.name;
      inst.mainComponent = this;
      return inst;
    },
    setGridStyleIdAsync: function(id){ this.gridStyleId = id; return Promise.resolve(); },
    findOne: function(pred){
      var stack = (this.children || []).slice();
      while (stack.length) {
        var n = stack.shift();
        if (pred(n)) return n;
        if (n.children) Array.prototype.push.apply(stack, n.children);
      }
      return null;
    }
  };
  for (var i=0;i<n.children.length;i++) n.children[i].parent = n;
  strictLayout(n);
  figma._nodes[n.id] = n;
  return n;
}

// The real API THROWS on these, and code that silently swallows the throw
// produces a layout that does not flow. Enforce them so the tests mean
// something.
function strictLayout(n){
  function isAL(x){ return !!x && typeof x.layoutMode === 'string' && x.layoutMode !== 'NONE'; }
  ['layoutSizingHorizontal','layoutSizingVertical'].forEach(function(prop){
    var v = n[prop];
    Object.defineProperty(n, prop, {
      configurable: true, enumerable: true,
      get: function(){ return v; },
      set: function(next){
        if (next === 'FILL' && !isAL(this.parent)) {
          throw new Error('"FILL" is only valid on auto-layout children');
        }
        if (next === 'HUG' && !isAL(this) && this.type !== 'TEXT') {
          throw new Error('"HUG" is only valid on auto-layout frames and text nodes');
        }
        v = next;
      }
    });
  });

  var wrap = n.layoutWrap;
  Object.defineProperty(n, 'layoutWrap', {
    configurable: true, enumerable: true,
    get: function(){ return wrap; },
    set: function(next){
      if (next === 'WRAP' && !isAL(this)) {
        throw new Error('layoutWrap requires layoutMode HORIZONTAL or VERTICAL');
      }
      wrap = next;
    }
  });

  ['minWidth','maxWidth','minHeight','maxHeight'].forEach(function(prop){
    var mv = n[prop];
    Object.defineProperty(n, prop, {
      configurable: true, enumerable: true,
      get: function(){ return mv; },
      set: function(next){
        if (next !== null && !isAL(this) && !isAL(this.parent)) {
          throw new Error('Can only set ' + prop + ' on auto layout nodes and their children');
        }
        mv = next;
      }
    });
  });
}
globalThis.strictLayout = strictLayout;

// clone() copies plugin data in the real API, which is what lets a generated
// frame carry the rules it was generated from.
function cloneNode(src){
  var copy;
  if (src.type === 'TEXT') {
    copy = mkText(src.characters, src.name);
  } else {
    copy = mkFrame({ name: src.name, layoutMode: src.layoutMode, layoutWrap: src.layoutWrap,
      layoutSizingHorizontal: src.layoutSizingHorizontal, layoutSizingVertical: src.layoutSizingVertical,
      width: src.width, height: src.height,
      paddingLeft: src.paddingLeft, paddingRight: src.paddingRight,
      paddingTop: src.paddingTop, paddingBottom: src.paddingBottom,
      itemSpacing: src.itemSpacing, counterAxisSpacing: src.counterAxisSpacing,
      cornerRadius: src.cornerRadius, children: [] });
  }
  copy.visible = src.visible;
  copy.locked = src.locked;
  for (var k in src._plugin) copy._plugin[k] = src._plugin[k];
  if (src.boundVariables) { copy.boundVariables = {}; for (var b in src.boundVariables) copy.boundVariables[b] = src.boundVariables[b]; }
  if (src.explicitVariableModes) { copy.explicitVariableModes = {}; for (var m in src.explicitVariableModes) copy.explicitVariableModes[m] = src.explicitVariableModes[m]; }
  if (src.children) for (var i=0;i<src.children.length;i++) copy.appendChild(cloneNode(src.children[i]));
  return copy;
}
globalThis.mkFrame = mkFrame;

function mkText(characters, name){
  var t = { id: nid('T'), type:'TEXT', name: name || characters, characters: characters,
           visible:true, locked:false, parent:null, boundVariables:{}, explicitVariableModes:{}, _plugin:{},
           width: 100, height: 20,
           setPluginData:function(k,v){ this._plugin[k]=String(v); },
           getPluginData:function(k){ return this._plugin[k]||''; },
           setBoundVariable:function(f,v){ if (v===null) delete this.boundVariables[f]; else this.boundVariables[f]={type:'VARIABLE_ALIAS',id:v.id}; },
           remove:function(){ this.removed = true;
             if (this.parent && this.parent.children) { var j=this.parent.children.indexOf(this); if(j>=0) this.parent.children.splice(j,1); } },
           resize:function(w,h){ this.width=w; this.height=h; },
           clone:function(){ return cloneNode(this); } };
  // A real text node always has both, and textTypeRuns skips a segment
  // without them — so omitting them here made every text layer invisible.
  t.fontName = { family: 'Inter', style: 'Regular' };
  t.fontSize = 16;
  t.lineHeight = { unit:'PERCENT', value: 150 };
  t.letterSpacing = { unit:'PERCENT', value: 0 };
  t.textStyleId = '';
  t.getStyledTextSegments = function(fields){
    var seg = { start: 0, end: String(this.characters || '').length,
                characters: String(this.characters || ''),
                fontName: this.fontName, fontSize: this.fontSize,
                lineHeight: this.lineHeight, letterSpacing: this.letterSpacing,
                textCase: 'ORIGINAL', textDecoration: 'NONE',
                fillStyleId: '', textStyleId: this.textStyleId,
                fills: Array.isArray(this.fills) ? this.fills : [],
                boundVariables: this.boundVariables };
    return [seg];
  };
  t.getRangeFills = function(a,b){ return Array.isArray(this.fills) ? this.fills.slice() : []; };
  t.setRangeFills = function(a,b,f){ this.fills = f; };
  t.setRangeBoundVariable = function(a,b,field,v){
    if (v === null) delete this.boundVariables[field];
    else this.boundVariables[field] = { type:'VARIABLE_ALIAS', id: v.id };
  };
  t.getRangeAllFontNames = function(){ return [this.fontName]; };
  t.layoutSizingHorizontal = 'FIXED';
  t.layoutSizingVertical = 'FIXED';
  t.layoutWrap = 'NO_WRAP';
  t.minWidth = null; t.maxWidth = null; t.minHeight = null; t.maxHeight = null;
  strictLayout(t);
  figma._nodes[t.id] = t;
  return t;
}
globalThis.mkText = mkText;

globalThis.__html__ = "<html></html>";
