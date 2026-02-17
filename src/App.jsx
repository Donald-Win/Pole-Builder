import React, { useState, useMemo, useCallback, useRef } from 'react';
import { Layers, ArrowLeft, ChevronRight, ClipboardList, RefreshCcw } from 'lucide-react';

// ════════════════════════════════════════════════════════════════════════════
// XARM CONFIGURATION DATA
// ════════════════════════════════════════════════════════════════════════════

const XARM_SECTIONS = ['Voltage', 'Configuration', 'Dimension', 'Length', 'Number', 'Material', 'Wires'];

const XARM_DATA = {
  Voltage: ["LV", "LVTX", "11", "33", "66"],
  Configuration: ["PN", "T", "TT", "PS", "TPS1", "TPS2", "TPS3", "TPS1T", "TPS2T", "TPS3T", "TPS4T", "TPS6T",
    "DPS", "DTPS3T", "DTPS5T", "EDO", "EDOTPS1", "EDOTPS3", "ABIL", "B", "SUP", "TFLYW", "TFLYS",
    "OPS", "SP1", "SP2"],
  Dimension: ["A", "B", "D", "E", "Z"],
  Length: ["12", "16", "20", "23", "30", "33", "40", "50", "60"],
  Number: ["1", "2"],
  Material: ["T", "S", "C"],
  Wires: ["1", "2", "3", "4", "5", "6", "32", "42", "43", "54", "64", "65"]
};

const DIMENSION_MAP = { A: "75x100mm", B: "100x100mm", D: "100x150mm", E: "125x150mm", Z: "75x75mm Angle" };
const MATERIAL_MAP = { T: "Timber", S: "Steel", C: "Composite" };
const EXPLICIT_PIN_ARMS = ["PN", "SUP", "OPS"];
const BOLT_SIZES = [100, 110, 130, 140, 150, 160, 180, 200, 220, 240, 260, 280, 300, 325, 350, 375, 400, 425, 450, 475, 500, 525, 550, 575, 600];

// ════════════════════════════════════════════════════════════════════════════
// POLE CONFIGURATION DATA
// ════════════════════════════════════════════════════════════════════════════

const POLE_SECTIONS = ['Length', 'Number', 'Manufacturer', 'Material'];

const POLE_DATA = {
  Length: ['75', '90', '95', '100', '105', '110', '115', '120', '124', '125', '136', '148', '155', '185'],
  Number: ['S', 'D', 'H'],
  Manufacturer: ['B', 'D', 'H', 'G', 'I', 'GP', 'HW'],
  Material: ['C', 'F', 'G', 'H', 'P', 'PH', 'S', 'SL']
};

const POLE_NUMBER_MAP = { S: 'Single', D: 'Double', H: 'H-Structure' };
const POLE_MFR_MAP = {
  B: 'Busck', D: 'Dulhunty', H: 'Hume', G: 'Industrial Galvanisers',
  I: 'International Utility Poles', GP: 'Goldpine Electropoles', HW: 'Hardwood Poles'
};
const POLE_MAT_MAP = {
  C: 'Reinforced Concrete', F: 'Glass Fibre Reinforced Concrete', G: 'Galvanised Steel',
  H: 'Hardwood', P: 'Prestressed Concrete', PH: 'Prestressed Heavy Concrete',
  S: 'Softwood (12kN)', SL: 'Softwood Light (9kN)'
};

// ════════════════════════════════════════════════════════════════════════════
// BOLT SIZING CALCULATOR
// ════════════════════════════════════════════════════════════════════════════

function calcBoltSizing(sel, poleWidth) {
  if (!sel.Dimension) return null;
  const isPinArm = EXPLICIT_PIN_ARMS.includes(sel.Configuration) ||
    (["LV", "LVTX"].includes(sel.Voltage) && sel.Configuration === "PN") ||
    (["11", "33", "66"].includes(sel.Voltage) && sel.Configuration === "PS");

  let singleArmWidth = 100;
  if (sel.Dimension === "A") singleArmWidth = isPinArm ? 75 : 100;
  else if (sel.Dimension === "E") singleArmWidth = 125;
  else if (sel.Dimension === "Z") singleArmWidth = 75;

  const numArms = parseInt(sel.Number) || 1;
  const totalArmWidth = singleArmWidth * numArms;
  const pw = parseInt(poleWidth) || 0;

  const isSteel = sel.Material === 'S' || sel.Voltage === 'LVTX';
  const kbReq = pw + totalArmWidth + 60;
  const kbIdx = BOLT_SIZES.findIndex(s => s >= kbReq);
  const kingBoltSize = isSteel
    ? BOLT_SIZES[Math.max(0, kbIdx - 1)]
    : (kbIdx !== -1 ? BOLT_SIZES[kbIdx] : BOLT_SIZES[BOLT_SIZES.length - 1]);
  const spacerBoltSize = BOLT_SIZES[Math.max(0, kbIdx - 1)];

  const lbReq = pw + 50;
  const lbIdx = BOLT_SIZES.findIndex(s => s >= lbReq);
  const longBraceBoltSize = lbIdx !== -1 ? BOLT_SIZES[lbIdx] : BOLT_SIZES[BOLT_SIZES.length - 1];

  const tbReq = pw + 40;
  const tbIdx = BOLT_SIZES.findIndex(s => s >= tbReq);
  const tBracketBoltSize = tbIdx !== -1 ? BOLT_SIZES[tbIdx] : BOLT_SIZES[BOLT_SIZES.length - 1];

  return { kingBoltSize, spacerBoltSize, longBraceBoltSize, isPinArm, isSteel, tBracketBoltSize };
}

// ════════════════════════════════════════════════════════════════════════════
// PICK LIST HELPERS
// ════════════════════════════════════════════════════════════════════════════

// Normalized item helpers - same size = same ID so aggregation works correctly
const m16bolt = (size, qty) => ({ id: `M16-${size}`, name: `M16 x ${size}mm Bolt`, qty, category: 'M16 Bolts' });
const m12bolt = (size, qty) => ({ id: `M12-${size}`, name: `M12 x ${size}mm Bolt`, qty, category: 'M12 Bolts' });
const m16washer = (qty) => ({ id: 'WASH-M16-50x50', name: 'M16 x 50x50 Square Washer', qty, category: 'Washers' });
const m12washer = (qty) => ({ id: 'WASH-M12-50x50', name: 'M12 x 50x50 Square Washer', qty, category: 'Washers' });
const m20washer = (qty) => ({ id: 'WASH-M20-80x80', name: 'M20 x 80x80 Large Washer', qty, category: 'Washers' });
const conical   = (qty) => ({ id: 'WASH-CONICAL', name: 'Conical Washer', qty, category: 'Washers' });
const m16nut    = (qty) => ({ id: 'NUT-M16', name: 'M16 Nut', qty, category: 'Nuts' });
const m12nut    = (qty) => ({ id: 'NUT-M12', name: 'M12 Nut', qty, category: 'Nuts' });

function generateXarmPickList(sel, poleWidth, boltSizing) {
  if (!boltSizing || !sel.Configuration) return [];

  const { Voltage: voltage, Configuration: config, Material: material,
    Dimension: dimension, Length: lengthRaw, Number: num, Wires: wiresStr } = sel;
  const armCount = parseInt(num) || 1;
  const isHV = ["11", "33", "66"].includes(voltage);
  const isLVTX = voltage === 'LVTX';
  const isLV = ["LV", "LVTX"].includes(voltage);
  const isEDO = config.includes("EDO");
  const pw = parseInt(poleWidth) || 0;

  const items = [{
    id: `ARM-${material}${isHV ? 'HV' : 'LV'}-${config}-${dimension}-${lengthRaw}`,
    name: `${material === 'T' ? '' : MATERIAL_MAP[material] + ' '}${isHV ? 'HV' : 'LV'} ${armCount === 2 ? 'Double' : 'Single'} ${config === "EDO" ? 'DDO Arm' : (boltSizing.isPinArm ? 'Pin Arm' : 'Crossarm')} - ${DIMENSION_MAP[dimension]} x ${(parseInt(lengthRaw) / 10).toFixed(1)}m`,
    qty: armCount,
    category: 'Arms'
  }];

  // King bolt assembly
  if (config !== 'TFLYW' && config !== 'TFLYS') {
    items.push(m16bolt(boltSizing.kingBoltSize, 1));
    items.push(m16washer(2));
    items.push(m16nut(1));
    if (material === 'T') {
      items.push(m20washer(1));
      items.push(conical(1));
    }
  }

  // Wire quantities
  let baseWireQty = 0;
  if (wiresStr) {
    const v = parseInt(wiresStr);
    baseWireQty = v < 10 ? v : wiresStr.split('').map(Number).reduce((a, b) => a + b, 0);
  }

  // LV insulators
  if (isLV && wiresStr && config !== 'B') {
    if (boltSizing.isPinArm) {
      items.push({ id: 'INS-LV-PIN', name: 'LV Pin Insulator', qty: baseWireQty * armCount, category: 'Insulators' });
    } else if (config === "T" || config === "TT" || config.startsWith("TPS") || config === "TFLYW" || config === "TFLYS") {
      const termQty = baseWireQty * (config === "TT" ? 2 : 1);
      const armBoltSize = dimension === "A" ? 110 : 130;
      items.push({ id: 'INS-LV-BOB', name: 'LV Bobbin', qty: termQty, category: 'Insulators' });
      items.push({ id: 'STRAP-SH-7', name: '7" Shackle Strap', qty: termQty * 2, category: 'Fittings' });
      items.push(m12bolt(110, termQty));
      items.push(m12bolt(armBoltSize, termQty));
      items.push(m12nut(termQty * 2));
    }
  }

  // HV insulators
  if (isHV && config !== 'B') {
    const termCount = (config.match(/T/g) || []).length;
    const postMatch = config.match(/\d+/);
    const postQty = postMatch ? parseInt(postMatch[0]) : (config.includes('PS') ? baseWireQty * armCount : 0);
    const hasEDO2 = config.includes('EDO');
    const hasDelta = config.startsWith('D');
    const vLabel = `${voltage}kV`;

    if (hasEDO2) items.push({ id: `EDO-${voltage}KV`, name: `${vLabel} Expulsion Drop Out (EDO) Cutout`, qty: baseWireQty, category: 'Insulators' });
    if (postQty > 0) items.push({ id: `INS-POST-${voltage}KV`, name: `${vLabel} Post Insulator`, qty: postQty, category: 'Insulators' });
    if (termCount > 0) {
      const termQty = baseWireQty * termCount;
      items.push(m16bolt(250, termQty));
      items.push({ id: `INS-TERM-${voltage}KV`, name: `${vLabel} Polymeric Term Insulator`, qty: termQty, category: 'Insulators' });
      items.push({ id: 'CLIP-RFI', name: 'R.F.I. Clip', qty: termQty, category: 'Fittings' });
      items.push({ id: 'CLEVIS', name: 'Clevis', qty: termQty, category: 'Fittings' });
    }
    if (hasDelta) items.push({ id: 'BRACKET-DELTA', name: 'Delta Bracket', qty: 1, category: 'Fittings' });
  }

  // Timber braces
  if (material === 'T' && config !== 'TFLYW' && config !== 'TFLYS') {
    const braceSize = parseInt(lengthRaw) >= 30 ? "900mm" : "763mm";
    const shortBoltSize = dimension === "A" ? (boltSizing.isPinArm ? 110 : 140) : (dimension === "E" ? 180 : 140);
    items.push({ id: `BRACE-${braceSize.substring(0, 3)}`, name: `${braceSize} Arm Brace`, qty: isEDO ? 1 : 2, category: 'Fittings' });
    items.push(m12washer(isEDO ? 2 : 3));
    items.push(m12nut(isEDO ? 2 : 3));
    items.push(m12bolt(shortBoltSize, isEDO ? 1 : 2));
    items.push(m12bolt(boltSizing.longBraceBoltSize, 1));
  }

  // Steel braces
  if (material === 'S' && !isLVTX && config !== 'TFLYW' && config !== 'TFLYS') {
    items.push({ id: 'BRACE-STEEL-ADJ', name: 'Adjustable Steel Arm Brace', qty: 2, category: 'Fittings' });
    items.push({ id: 'BOLT-M12-ADJ', name: 'M12 Adjustable Brace Bolt', qty: 2, category: 'M12 Bolts' });
    items.push(m12bolt(boltSizing.longBraceBoltSize, 1));
  }

  // TFLYW
  if (config === 'TFLYW') {
    const tflyBolt = dimension === 'A' ? 240 : 280;
    items.push(m20washer(2));
    items.push(conical(2));
    items.push(m16bolt(tflyBolt, 2));
    items.push(m16nut(2));
  }

  // TFLYS
  if (config === 'TFLYS') {
    const tflysBolt = dimension === 'A' ? 240 : 280;
    items.push({ id: 'BRACKET-STEEL-FLY', name: 'Steel Fly Arm Bracket', qty: 1, category: 'Fittings' });
    items.push(m20washer(1));
    items.push(conical(1));
    items.push(m16bolt(tflysBolt, 1));
    items.push(m16washer(2));
  }

  // LVTX T bracket
  if (isLVTX) {
    items.push({ id: 'BRACKET-T-STEEL', name: 'Steel T Bracket', qty: 1, category: 'Fittings' });
    items.push(m12bolt(140, 2));
    items.push(m12washer(4));
    items.push(m16bolt(boltSizing.tBracketBoltSize, 1));
    items.push(m16washer(2));
  }

  // Double arm spacer
  if (armCount === 2) {
    const spacerPipeLength = pw - 5;
    items.push(m16bolt(boltSizing.spacerBoltSize, 1));
    items.push(m16washer(4));
    items.push({ id: `PIPE-SPACER-${spacerPipeLength}`, name: `Spacer Pipe (${spacerPipeLength}mm)`, qty: 1, category: 'Fittings' });
  }

  return items;
}

// ════════════════════════════════════════════════════════════════════════════
// POLE PICK LIST GENERATOR
// ════════════════════════════════════════════════════════════════════════════

function generatePolePickList(sel) {
  if (!sel.Length || !sel.Number || !sel.Manufacturer || !sel.Material) return [];
  const { Length, Number: num, Manufacturer: mfr, Material: mat } = sel;
  const items = [];
  const poleQty = num === 'S' ? 1 : 2;
  const lengthMeters = (parseInt(Length) / 10).toFixed(1);
  items.push({ id: `POLE-${Length}-${num}-${mfr}-${mat}`, name: `${lengthMeters}m ${POLE_MFR_MAP[mfr]} ${POLE_MAT_MAP[mat]} Pole`, qty: poleQty, category: 'Pole' });
  if (num === 'S') items.push({ id: 'BREAST-PLASTIC', name: 'Plastic Breast Block', qty: 2, category: 'Pole Hardware' });
  else if (num === 'D') items.push({ id: 'BREAST-CONCRETE', name: 'Concrete Breast Block', qty: 2, category: 'Pole Hardware' });
  else if (num === 'H') items.push({ id: 'BREAST-PLASTIC', name: 'Plastic Breast Block', qty: 4, category: 'Pole Hardware' });
  if (num === 'S' && mfr === 'B') items.push({ id: 'DONUT-PLASTIC-POLE', name: 'Plastic Pole Donut', qty: 1, category: 'Pole Hardware' });
  else if (num === 'D' && mfr === 'B') items.push({ id: 'DONUT-CONCRETE-DOUBLE', name: 'Concrete Double Donut', qty: 1, category: 'Pole Hardware' });
  return items;
}

// ════════════════════════════════════════════════════════════════════════════
// APP COMPONENT
// ════════════════════════════════════════════════════════════════════════════

const App = () => {
  // Class selection
  const [selectedClass, setSelectedClass] = useState(null); // 'POLE' or 'XARM'

  // Saved items
  const [poles, setPoles] = useState([]);
  const [levels, setLevels] = useState([]);
  const [currentPole, setCurrentPole] = useState(1);
  const [currentLevel, setCurrentLevel] = useState(1);

  // Wizard state
  const [activeStep, setActiveStep] = useState(0);
  const [selections, setSelections] = useState({});
  const [poleWidth, setPoleWidth] = useState(150);

  // UI state
  const [showPoleInput, setShowPoleInput] = useState(false);
  const [showItemSummary, setShowItemSummary] = useState(false);
  const [isFinalized, setIsFinalized] = useState(false);
  const [justSavedCode, setJustSavedCode] = useState('');

  // KEY FIX: Use a ref to hold completed XARM selections so they're never stale
  const completedXarmSelections = useRef({});
  const completedXarmPoleWidth = useRef(150);

  // Current wizard context
  const sections = selectedClass === 'XARM' ? XARM_SECTIONS : POLE_SECTIONS;
  const configData = selectedClass === 'XARM' ? XARM_DATA : POLE_DATA;
  const currentSection = sections[activeStep];
  const options = configData[currentSection] || [];

  // Live code preview (for the building display during wizard)
  const liveCode = useMemo(() => {
    if (!selectedClass) return '';
    const prefix = selectedClass === 'XARM' ? 'XARM' : 'POLE';
    return `${prefix}-${sections.map(s => selections[s] || '—').join('-')}`;
  }, [selectedClass, selections, sections]);

  // Bolt sizing for preview during wizard
  const boltSizing = useMemo(() => {
    if (selectedClass !== 'XARM') return null;
    return calcBoltSizing(selections, poleWidth);
  }, [selectedClass, selections, poleWidth]);

  // Aggregated pick list for final screen
  const aggregatedPickList = useMemo(() => {
    if (!isFinalized) return [];
    const itemMap = new Map();
    [...poles, ...levels].forEach(item => {
      (item.pickList || []).forEach(pl => {
        if (itemMap.has(pl.id)) {
          itemMap.get(pl.id).qty += pl.qty;
        } else {
          itemMap.set(pl.id, { ...pl });
        }
      });
    });
    return Array.from(itemMap.values());
  }, [poles, levels, isFinalized]);

  const CATEGORY_ORDER = ['Arms', 'Insulators', 'M16 Bolts', 'M12 Bolts', 'Washers', 'Nuts', 'Fittings', 'Pole', 'Pole Hardware'];

  const groupedPickList = useMemo(() => {
    const groups = {};
    aggregatedPickList.forEach(item => {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    });
    // Sort M16 and M12 bolt groups by size descending
    ['M16 Bolts', 'M12 Bolts'].forEach(cat => {
      if (groups[cat]) {
        groups[cat].sort((a, b) => {
          const sizeA = parseInt(a.id.match(/\d+$/)?.[0] || 0);
          const sizeB = parseInt(b.id.match(/\d+$/)?.[0] || 0);
          return sizeB - sizeA;
        });
      }
    });
    return groups;
  }, [aggregatedPickList]);

  // ── Event handlers ──────────────────────────────────────────────────────

  const handleClassSelect = (cls) => {
    setSelectedClass(cls);
    setSelections({});
    setActiveStep(0);
  };

  const handleSelect = (option) => {
    const updated = { ...selections, [currentSection]: option };
    setSelections(updated);

    if (activeStep < sections.length - 1) {
      setActiveStep(prev => prev + 1);
    } else if (selectedClass === 'XARM') {
      // Store in ref - never stale, always current
      completedXarmSelections.current = updated;
      setShowPoleInput(true);
    } else {
      // POLE completes immediately - pass selections directly
      savePole(updated);
    }
  };

  const saveXarm = () => {
    // Read from ref - guaranteed to have the completed selections
    const sel = completedXarmSelections.current;
    const pw = parseInt(poleWidth) || 150;
    const sizing = calcBoltSizing(sel, pw);
    const code = `XARM-${XARM_SECTIONS.map(s => sel[s] || '—').join('-')}`;
    const pickList = generateXarmPickList(sel, pw, sizing);

    setLevels(prev => [...prev, {
      level: currentLevel,
      selections: { ...sel },
      poleWidth: pw,
      code,
      pickList
    }]);
    setCurrentLevel(prev => prev + 1);
    setJustSavedCode(code);

    // Reset wizard
    completedXarmSelections.current = {};
    setSelections({});
    setActiveStep(0);
    setPoleWidth(150);
    setShowPoleInput(false);
    setShowItemSummary(true);
  };

  const savePole = (sel) => {
    const code = `POLE-${POLE_SECTIONS.map(s => sel[s]).join('-')}`;
    const pickList = generatePolePickList(sel);

    setPoles(prev => [...prev, {
      pole: currentPole,
      selections: { ...sel },
      code,
      pickList
    }]);
    setCurrentPole(prev => prev + 1);
    setJustSavedCode(code);

    // Reset wizard
    setSelections({});
    setActiveStep(0);
    setShowItemSummary(true);
  };

  const goBack = () => {
    if (showPoleInput) {
      setShowPoleInput(false);
    } else if (activeStep > 0) {
      setActiveStep(prev => prev - 1);
    } else {
      setSelectedClass(null);
    }
  };

  const reset = () => {
    setSelectedClass(null);
    setPoles([]);
    setLevels([]);
    setCurrentPole(1);
    setCurrentLevel(1);
    setActiveStep(0);
    setSelections({});
    setPoleWidth(150);
    setShowPoleInput(false);
    setShowItemSummary(false);
    setIsFinalized(false);
    setJustSavedCode('');
    completedXarmSelections.current = {};
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 md:p-8">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <header className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <Layers className="text-blue-600" size={28} /> XARM
          </h1>
          <button onClick={reset} className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-500 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all shadow-sm active:scale-95">
            <RefreshCcw size={14} /> RESET
          </button>
        </header>

        {/* ── CLASS SELECTION ───────────────────────────────────────────── */}
        {!selectedClass && !showItemSummary && !isFinalized && (
          <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden">
            <div className="p-8 border-b border-slate-50">
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">Choose Component Class</h2>
              <p className="text-slate-400 text-xs font-bold tracking-widest uppercase mt-1">Select what you want to configure</p>
            </div>
            <div className="p-8 grid grid-cols-2 gap-4">
              {['POLE', 'XARM'].map(cls => (
                <button key={cls} onClick={() => handleClassSelect(cls)}
                  className="group p-8 bg-slate-50 hover:bg-blue-50 border-2 border-slate-50 hover:border-blue-500 rounded-2xl transition-all active:scale-95">
                  <div className="text-3xl font-black text-slate-800 group-hover:text-blue-600 transition-colors mb-2">{cls}</div>
                  <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                    {cls === 'POLE' ? 'Pole Configuration' : 'Crossarm Configuration'}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── WIZARD ────────────────────────────────────────────────────── */}
        {selectedClass && !showPoleInput && !showItemSummary && !isFinalized && (
          <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden">
            <div className="p-8 border-b border-slate-50 flex items-center gap-4">
              <button onClick={goBack} className="p-2 hover:bg-slate-50 rounded-full transition-colors text-slate-400">
                <ArrowLeft size={24} />
              </button>
              <div>
                <div className="inline-flex items-center px-3 py-1 bg-blue-50 rounded-full text-xs font-bold text-blue-600 uppercase mb-2">
                  {selectedClass === 'POLE' ? `Pole ${currentPole}` : `Level ${currentLevel}`}
                </div>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight capitalize">{currentSection}</h2>
                <p className="text-slate-400 text-xs font-bold tracking-widest uppercase mt-1">Step {activeStep + 1} of {sections.length}</p>
              </div>
            </div>
            <div className="p-8">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {options.map(option => (
                  <button key={option} onClick={() => handleSelect(option)}
                    className="group p-6 bg-slate-50 hover:bg-blue-50 border-2 border-slate-50 hover:border-blue-500 rounded-2xl transition-all active:scale-95">
                    <div className="text-2xl font-black text-slate-800 group-hover:text-blue-600 transition-colors mb-1">{option}</div>
                    <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                      {selectedClass === 'POLE' && currentSection === 'Number' && POLE_NUMBER_MAP[option]}
                      {selectedClass === 'POLE' && currentSection === 'Manufacturer' && POLE_MFR_MAP[option]}
                      {selectedClass === 'POLE' && currentSection === 'Material' && POLE_MAT_MAP[option]}
                      {selectedClass === 'POLE' && currentSection === 'Length' && `${(parseInt(option) / 10).toFixed(1)}m`}
                      {selectedClass === 'XARM' && currentSection === 'Dimension' && DIMENSION_MAP[option]}
                      {selectedClass === 'XARM' && currentSection === 'Material' && MATERIAL_MAP[option]}
                    </div>
                  </button>
                ))}
              </div>
              {Object.keys(selections).length > 0 && (
                <div className="mt-6 p-4 bg-slate-900 rounded-2xl">
                  <div className="text-xs text-blue-400 font-black uppercase tracking-widest mb-2">Building</div>
                  <div className="text-lg font-mono font-black text-white">{liveCode}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── POLE WIDTH INPUT ──────────────────────────────────────────── */}
        {showPoleInput && !showItemSummary && (
          <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden">
            <div className="p-8 border-b border-slate-50 flex items-center gap-4">
              <button onClick={goBack} className="p-2 hover:bg-slate-50 rounded-full transition-colors text-slate-400">
                <ArrowLeft size={24} />
              </button>
              <div>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">Pole Width</h2>
                <p className="text-slate-400 text-xs font-bold tracking-widest uppercase mt-1">Enter the pole diameter at mounting height</p>
              </div>
            </div>
            <div className="p-8 space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-2">Pole Width (mm)</label>
                <input type="number" value={poleWidth} onChange={e => setPoleWidth(e.target.value)}
                  className="w-full px-6 py-4 text-2xl font-mono font-black text-slate-800 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:border-blue-500 focus:outline-none transition-colors" />
              </div>
              {boltSizing && (
                <div className="bg-blue-50 rounded-2xl p-4 border-2 border-blue-100">
                  <div className="text-[10px] text-blue-600 font-black uppercase tracking-widest mb-2">Calculated Sizes</div>
                  <div className="grid grid-cols-3 gap-4">
                    <div><div className="text-xs text-slate-500 font-bold mb-1">King Bolt</div><div className="text-sm font-bold text-blue-900">{boltSizing.kingBoltSize}mm</div></div>
                    <div><div className="text-xs text-slate-500 font-bold mb-1">Spacer</div><div className="text-sm font-bold text-blue-900">{boltSizing.spacerBoltSize}mm</div></div>
                    <div><div className="text-xs text-slate-500 font-bold mb-1">Brace</div><div className="text-sm font-bold text-blue-900">{boltSizing.longBraceBoltSize}mm</div></div>
                  </div>
                </div>
              )}
              <div className="bg-slate-900 rounded-2xl p-6 text-white">
                <div className="text-blue-400 text-xs font-black uppercase tracking-widest mb-2">Building</div>
                <div className="text-lg font-mono font-black">{liveCode}</div>
              </div>
              <button onClick={saveXarm}
                className="w-full py-6 bg-blue-600 text-white rounded-3xl font-black text-xl hover:bg-blue-700 shadow-xl shadow-blue-100 transition-all flex items-center justify-center gap-3 active:scale-95">
                SAVE LEVEL {currentLevel} <ChevronRight />
              </button>
            </div>
          </div>
        )}

        {/* ── ITEM SUMMARY ──────────────────────────────────────────────── */}
        {showItemSummary && !isFinalized && (
          <div className="space-y-6">
            <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden p-8">
              <h2 className="text-2xl font-black text-slate-800 mb-6">
                {selectedClass === 'POLE' ? `Pole ${currentPole - 1} Saved` : `Level ${currentLevel - 1} Saved`}
              </h2>
              <div className="bg-slate-900 rounded-2xl p-6 mb-6 text-white">
                <div className="text-blue-400 text-xs font-black uppercase tracking-widest mb-2">Build Code</div>
                <div className="text-xl font-mono font-black">{justSavedCode}</div>
              </div>
              <div className="space-y-3">
                <button onClick={() => { setSelectedClass(null); setShowItemSummary(false); }}
                  className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2 active:scale-95">
                  Add Another Component <ChevronRight />
                </button>
                <button onClick={() => { setShowItemSummary(false); setIsFinalized(true); }}
                  className="w-full py-4 bg-slate-800 text-white rounded-2xl font-black text-lg hover:bg-slate-900 transition-all flex items-center justify-center gap-2 active:scale-95">
                  Finalize Pick List ({poles.length} {poles.length === 1 ? 'Pole' : 'Poles'}, {levels.length} {levels.length === 1 ? 'Level' : 'Levels'})
                </button>
              </div>
            </div>
            {(poles.length > 0 || levels.length > 0) && (
              <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 p-6">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Configured Items</h3>
                <div className="space-y-3">
                  {poles.map(p => (
                    <div key={p.pole} className="bg-slate-50 rounded-xl p-4">
                      <div className="text-xs font-bold text-slate-600 mb-1">Pole {p.pole}</div>
                      <div className="text-sm font-mono font-bold text-slate-800">{p.code}</div>
                    </div>
                  ))}
                  {levels.map(l => (
                    <div key={l.level} className="bg-slate-50 rounded-xl p-4">
                      <div className="text-xs font-bold text-blue-600 mb-1">Level {l.level}</div>
                      <div className="text-sm font-mono font-bold text-slate-700">{l.code}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── FINAL SCREEN ──────────────────────────────────────────────── */}
        {isFinalized && (
          <div className="space-y-6">
            {poles.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Poles</h3>
                {poles.map(p => (
                  <div key={p.pole} className="bg-slate-900 rounded-2xl p-6 text-white">
                    <div className="text-blue-400 text-xs font-black uppercase tracking-widest mb-2">Pole {p.pole}</div>
                    <div className="text-lg font-mono font-black">{p.code}</div>
                  </div>
                ))}
              </div>
            )}
            {levels.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Crossarms</h3>
                {levels.map(l => (
                  <div key={l.level} className="bg-slate-900 rounded-2xl p-6 text-white">
                    <div className="flex justify-between mb-2">
                      <div className="text-blue-400 text-xs font-black uppercase tracking-widest">Level {l.level}</div>
                      <div className="text-xs text-slate-400 font-bold">Pole: {l.poleWidth}mm</div>
                    </div>
                    <div className="text-lg font-mono font-black">{l.code}</div>
                  </div>
                ))}
              </div>
            )}
            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="font-black flex items-center gap-2 text-slate-800 uppercase text-sm tracking-tight">
                  <ClipboardList size={18} className="text-blue-600" /> Aggregated Pick List
                </h3>
                <div className="text-xs text-slate-500 font-bold">{poles.length} {poles.length === 1 ? 'Pole' : 'Poles'}, {levels.length} {levels.length === 1 ? 'Level' : 'Levels'}</div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-slate-400 text-[9px] font-black uppercase tracking-widest border-b border-slate-100">
                      <th className="p-5">Reference</th>
                      <th className="p-5">Description</th>
                      <th className="p-5 text-right">Total Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aggregatedPickList.length === 0 ? (
                      <tr><td colSpan={3} className="p-8 text-center text-slate-400 text-sm">No items in pick list</td></tr>
                    ) : CATEGORY_ORDER.filter(cat => groupedPickList[cat]).map(category => { const items = groupedPickList[category]; return (
                      <React.Fragment key={category}>
                        <tr className="bg-slate-50/80">
                          <td colSpan={3} className="px-5 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">{category}</td>
                        </tr>
                        {items.map((item, i) => (
                          <tr key={i} className="hover:bg-slate-50/50 transition-colors border-t border-slate-50">
                            <td className="p-5 font-mono text-[11px] font-bold text-slate-500">{item.id}</td>
                            <td className="p-5 text-slate-800 text-xs font-bold uppercase">{item.name}</td>
                            <td className="p-5 text-right font-black text-slate-900 text-sm">{item.qty}</td>
                          </tr>
                        ))}
                      </React.Fragment>
                    );})}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default App;

