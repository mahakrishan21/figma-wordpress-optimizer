var pass=0, fail=0;
function ok(l,c,x){ if(c){pass++;print('PASS  '+l);} else {fail++;print('FAIL  '+l+(x?'  -> '+x:''));} }
function eq(l,g,w){ ok(l+'  ('+g+')', String(g)===String(w), 'want '+w); }
function rgb(h){ return {r:parseInt(h.slice(1,3),16)/255,g:parseInt(h.slice(3,5),16)/255,b:parseInt(h.slice(5,7),16)/255}; }
function solid(h,op){ return {type:'SOLID',color:rgb(h),opacity:op==null?1:op,visible:true}; }

figma._nodes={}; var ALL=[];
figma.getNodeByIdAsync=function(id){ return Promise.resolve(figma._nodes[id]||null); };
figma.getStyleByIdAsync=function(id){ var a=figma._paintStyles.concat(figma._textStyles);
  return Promise.resolve(a.filter(function(x){return x.id===id;})[0]||null); };
figma.loadAllPagesAsync=function(){ return Promise.resolve(); };
figma.loadFontAsync=function(){ return Promise.resolve(); };
figma.root={children:[figma.currentPage]};
figma.currentPage.findAll=function(fn){ return ALL.filter(fn); };

function layer(id,hex,op,styleId,varId,isText){
  var f=solid(hex,op); if(varId) f.boundVariables={color:{type:'VARIABLE_ALIAS',id:varId}};
  var n={ id:id,name:id,type:isText?'TEXT':'RECTANGLE',visible:true,locked:false,
    parent:{type:'FRAME',id:'F',parent:{type:'PAGE',id:'p1'}},
    characters:'Hi', fills:[f], strokes:[], fillStyleId:(!isText&&styleId)||'', strokeStyleId:'',
    textStyleId:(isText&&styleId)||'', boundVariables:{},
    fontName:{family:'Inter',style:'Regular'}, fontSize:16,
    lineHeight:{unit:'PERCENT',value:150}, letterSpacing:{unit:'PERCENT',value:0},
    getStyledTextSegments:function(){return [];},
    getRangeAllFontNames:function(){return [this.fontName];},
    setFillStyleIdAsync:function(v){this.fillStyleId=v;return Promise.resolve();},
    setStrokeStyleIdAsync:function(){return Promise.resolve();},
    setTextStyleIdAsync:function(v){this.textStyleId=v;return Promise.resolve();},
    setBoundVariable:function(){}, setRangeBoundVariable:function(){} };
  figma._nodes[id]=n; ALL.push(n); return n;
}

(async function(){
  // ── CASE 1: colour STYLE + VARIABLE, same value. Merge keeping the STYLE.
  var col=figma.variables.createVariableCollection('Design Tokens');
  var st=figma.createPaintStyle(); st.name='Neutral / White'; st.paints=[solid('#FFFFFF')];
  var v=figma.variables.createVariable('Neutral / White', col, 'COLOR');
  v.setValueForMode('m1', Object.assign(rgb('#FFFFFF'),{a:1}));
  var L1=layer('n1','#FFFFFF',1,st.id,null), L2=layer('n2','#FFFFFF',1,'',v.id);
  var frame={id:'F',name:'F',type:'FRAME',visible:true,width:10,height:10,
             parent:{type:'PAGE',id:'p1'},fills:[],strokes:[],children:[L1,L2]};
  figma._nodes['F']=frame; ALL.push(frame);
  figma.currentPage.selection=[frame]; figma.currentPage.children=[frame];

  var d1=await scanColors([frame]);
  eq('1. the pair is flagged as a near-duplicate before merging', d1.nearDupes.length, 1);

  await mergeTokens('paint', [{ keepId: st.id, keepKind:'style',
    members:[{id:st.id,kind:'style'},{id:v.id,kind:'variable'}] }], {});
  var d2=await scanColors([frame]);
  ok('2. AFTER merging into the style, the pair is gone', d2.nearDupes.length === 0,
     'still ' + d2.nearDupes.length + ': ' + JSON.stringify((d2.nearDupes[0]||[]).map(function(x){return x.kind+':'+x.name;})));
  ok('2. and the style really is bound to the variable',
     !!(st.paints[0].boundVariables && st.paints[0].boundVariables.color));

  // ── CASE 2: two duplicate TEXT STYLES. Merge keeping one.
  figma._paintStyles.length=0; figma._vars.length=0; figma._nodes={}; ALL=[];
  var ta=figma.createTextStyle(); ta.name='Body A';
  ta.fontName={family:'Inter',style:'Regular'}; ta.fontSize=16;
  ta.lineHeight={unit:'PERCENT',value:150}; ta.letterSpacing={unit:'PERCENT',value:0};
  var tb=figma.createTextStyle(); tb.name='Body B';
  tb.fontName={family:'Inter',style:'Regular'}; tb.fontSize=16;
  tb.lineHeight={unit:'PERCENT',value:150}; tb.letterSpacing={unit:'PERCENT',value:0};
  var T1=layer('t1','#000000',1,ta.id,null,true), T2=layer('t2','#000000',1,tb.id,null,true);
  var frame2={id:'F2',name:'F2',type:'FRAME',visible:true,width:10,height:10,
              parent:{type:'PAGE',id:'p1'},fills:[],strokes:[],children:[T1,T2]};
  figma._nodes['F2']=frame2; ALL.push(frame2);
  figma.currentPage.selection=[frame2]; figma.currentPage.children=[frame2];

  var t1=await scanText([frame2]);
  eq('3. two duplicate text styles are flagged', t1.duplicates.length, 1);

  var r=await mergeTokens('text', [{ keepId: ta.id, keepKind:'style',
    members:[{id:ta.id,kind:'style'},{id:tb.id,kind:'style'}] }], {});
  var t2=await scanText([frame2]);
  ok('4. AFTER merging text styles, the duplicate is gone', t2.duplicates.length === 0,
     'still ' + t2.duplicates.length + '; removed=' + r.removed + ' reasons=' + JSON.stringify(r.reasons));
  eq('4. the replaced style was deleted', figma._textStyles.length, 1);
  eq('4. its layer was re-linked to the keeper', T2.textStyleId, ta.id);

  // ── CASE 3: variable + variable still merges and clears (don't break it)
  figma._paintStyles.length=0; figma._textStyles.length=0; figma._vars.length=0;
  figma._cols.length=0; figma._nodes={}; ALL=[];
  var c3=figma.variables.createVariableCollection('T');
  var va=figma.variables.createVariable('Slate A', c3, 'COLOR');
  va.setValueForMode('m1', Object.assign(rgb('#54718E'),{a:1}));
  var vb=figma.variables.createVariable('Slate B', c3, 'COLOR');
  vb.setValueForMode('m1', Object.assign(rgb('#5C708B'),{a:1}));
  var VA=layer('va','#54718E',1,'',va.id), VB=layer('vb','#5C708B',1,'',vb.id);
  var f3={id:'F3',name:'F3',type:'FRAME',visible:true,width:10,height:10,
          parent:{type:'PAGE',id:'p1'},fills:[],strokes:[],children:[VA,VB]};
  figma._nodes['F3']=f3; ALL.push(f3);
  figma.currentPage.selection=[f3]; figma.currentPage.children=[f3];
  var d3=await scanColors([f3]);
  eq('5. two near-identical variables are flagged', d3.nearDupes.length, 1);
  await mergeTokens('paint', [{ keepId: va.id, keepKind:'variable',
    members:[{id:va.id,kind:'variable'},{id:vb.id,kind:'variable'}] }], {});
  var d4=await scanColors([f3]);
  eq('5. after merging variables, the pair is gone', d4.nearDupes.length, 0);
  eq('5. the replaced variable was deleted', figma._vars.length, 1);

  // ── CASE 4: a FAILED merge must leave the item listed for a retry
  figma._paintStyles.length=0; figma._vars.length=0; figma._cols.length=0; figma._nodes={}; ALL=[];
  var c4=figma.variables.createVariableCollection('T4');
  var ka=figma.variables.createVariable('Keep', c4, 'COLOR');
  ka.setValueForMode('m1', Object.assign(rgb('#111111'),{a:1}));
  var kb=figma.variables.createVariable('Drop', c4, 'COLOR');
  kb.setValueForMode('m1', Object.assign(rgb('#121212'),{a:1}));
  var stuck=layer('stuck','#121212',1,'',kb.id);
  Object.defineProperty(stuck,'fills',{ get:function(){ return this._f; },
    set:function(){ throw new Error('inside a remote instance'); } });
  stuck._f=[Object.assign(solid('#121212',1),{boundVariables:{color:{type:'VARIABLE_ALIAS',id:kb.id}}})];
  var f4={id:'F4',name:'F4',type:'FRAME',visible:true,width:10,height:10,
          parent:{type:'PAGE',id:'p1'},fills:[],strokes:[],children:[stuck]};
  figma._nodes['F4']=f4; ALL.push(f4);
  figma.currentPage.selection=[f4]; figma.currentPage.children=[f4];
  var d5=await scanColors([f4]);
  eq('6. the pair is flagged', d5.nearDupes.length, 1);
  var rf=await mergeTokens('paint', [{ keepId: ka.id, keepKind:'variable',
    members:[{id:ka.id,kind:'variable'},{id:kb.id,kind:'variable'}] }], {});
  var d6=await scanColors([f4]);
  eq('6. the failed merge kept the item listed for a retry', d6.nearDupes.length, 1);
  eq('6. and deleted nothing', figma._vars.length, 2);
  ok('6. with a reason shown', (rf.reasons||[]).length > 0, JSON.stringify(rf.reasons));

  // ── CASE 5: a bound style must not HIDE a genuine duplicate elsewhere
  figma._paintStyles.length=0; figma._vars.length=0; figma._cols.length=0; figma._nodes={}; ALL=[];
  var c5=figma.variables.createVariableCollection('T5');
  var v5=figma.variables.createVariable('Brand', c5, 'COLOR');
  v5.setValueForMode('m1', Object.assign(rgb('#2563EB'),{a:1}));
  var bound5=figma.createPaintStyle(); bound5.name='Brand (bound)';
  bound5.paints=[solid('#2563EB')];
  bindPaintStyleToExactVariable(bound5, v5);
  var loose=figma.createPaintStyle(); loose.name='Brand Copy';
  loose.paints=[solid('#2564EB')];                       // near-identical, unbound
  var f5={id:'F5',name:'F5',type:'FRAME',visible:true,width:10,height:10,
          parent:{type:'PAGE',id:'p1'},fills:[],strokes:[],children:[]};
  figma._nodes['F5']=f5; ALL.push(f5);
  figma.currentPage.selection=[f5]; figma.currentPage.children=[f5];
  var d7=await scanColors([f5]);
  eq('7. the unbound near-duplicate is still caught', d7.nearDupes.length, 1);
  var kinds=d7.nearDupes[0].map(function(x){return x.kind+':'+x.name;}).sort();
  eq('7. reported as variable vs the loose style, not the bound style',
     kinds.join(' | '), 'style:Brand Copy | variable:Brand');

  print('');
  print(fail ? ('*** ' + fail + ' FAILED, ' + pass + ' passed') : ('All ' + pass + ' assertions passed'));
})().catch(function(e){ print('HARNESS ERROR: ' + (e && e.stack || e)); });
