import React, { useState, useMemo, useCallback } from 'react';
import { 
  RefreshCcw, 
  Layers, 
  ClipboardList, 
  ChevronRight,
  ArrowLeft
} from 'lucide-react';

const CONFIG_DATA = {
  "Class": ["XARM"],
  "Voltage": ["11", "LV", "LVTX", "33", "66"],
  "Dimension": ["A", "B", "D", "E", "Z"],
  "Length": ["12", "16", "20", "23", "30", "33", "40", "50", "60"],
  "Number": ["1", "2"],
  "Configuration": [
    "PN", "T", "TT", "PS", "TPS1", "TPS2", "TPS3", "TPS1T", 
    "TPS2T", "TPS3T", "TPS4T", "TPS6T", "DPS", "DTPS3T", 
    "DTPS5T", "EDO", "EDOTPS1", "EDOTPS3", "ABIL", "B", 
    "SUP", "TFLYW", "TFLYS", "OPS", "SP1", "SP2"
  ],
  "Material": ["T", "S", "C"],
  "Wires": ["1", "2", "3", "4", "5", "6", "32", "42", "43", "54", "64", "65"]
};

const BOLT_SIZES = [100, 110, 130, 140, 150, 160, 180, 200, 220, 240, 260, 280, 300, 325, 350, 375, 400, 425, 450, 475, 500, 525, 550, 575, 600];

const DIMENSION_MAP = {
  "A": "75x100mm", "B": "100x100mm", "D": "100x150mm", "E": "125x150mm", "Z": "75x75mm Angle Iron"
};

const MATERIAL_MAP = { "T": "Timber", "S": "Steel", "C": "Composite" };
const EXPLICIT_PIN_ARMS = ["SUP", "OPS"];
const SECTIONS = Object.keys(CONFIG_DATA);

/**
 * Parses any config string into its component parts using simple string rules:
 *
 * - termCount : number of T characters in string = number of term sets per wire
 * - postQty   : digit in string = fixed post count; no digit + has 'PS' = wires × arms
 * - hasEDO    : config contains 'EDO' → 1× EDO cutout per wire
 * - hasDelta  : config starts with 'D' → 1× Delta Bracket
 *
 * Examples:
 *   T        → terms:1  post:0          EDO:false delta:false
 *   TT       → terms:2  post:0          EDO:false delta:false
 *   PS       → terms:0  post:wires×arms EDO:false delta:false
 *   DPS      → terms:0  post:wires×arms EDO:false delta:true
 *   TPS3     → terms:1  post:3          EDO:false delta:false
 *   TPS3T    → terms:2  post:3          EDO:false delta:false
 *   DTPS3T   → terms:2  post:3          EDO:false delta:true
 *   EDO      → terms:0  post:0          EDO:true  delta:false
 *   EDOTPS1  → terms:1  post:1          EDO:true  delta:false
 *   TFLYW    → terms:1  post:0          EDO:false delta:false
 *   TFLYS    → terms:1  post:0          EDO:false delta:false
 */
const parseConfig = (config, baseWireQty, armCount) => {
  const termCount = (config.match(/T/g) || []).length;
  const postMatch = config.match(/\d+/);
  const postQty   = postMatch
    ? parseInt(postMatch[0])
    : (config.includes('PS') ? baseWireQty * armCount : 0);
  const hasEDO    = config.includes('EDO');
  const hasDelta  = config.startsWith('D');

  return { termCount, postQty, hasEDO, hasDelta };
};

const App = () => {
  // Multi-level state: array of completed crossarms
  const [levels, setLevels] = useState([]);
  const [currentLevel, setCurrentLevel] = useState(1);
  const [selections, setSelections] = useState({});
  const [activeStep, setActiveStep] = useState(0);
  const [poleWidth, setPoleWidth] = useState(150); 
  const [showPoleInput, setShowPoleInput] = useState(false);
  const [showLevelSummary, setShowLevelSummary] = useState(false);
  const [isFinalized, setIsFinalized] = useState(false);

  const currentSection = SECTIONS[activeStep];
  const options = CONFIG_DATA[currentSection] || [];

  const generatedCode = useMemo(() => SECTIONS.map(s => selections[s] || '—').join('-'), [selections]);

  const boltSizingResult = useMemo(() => {
    if (!selections['Dimension']) return null;
    let singleArmWidth = 100; 
    const isPinArm = EXPLICIT_PIN_ARMS.includes(selections['Configuration']) || 
                    (["LV", "LVTX"].includes(selections['Voltage']) && selections['Configuration'] === "PN") || 
                    (["11", "33", "66"].includes(selections['Voltage']) && selections['Configuration'] === "PS");
    
    if (selections['Dimension'] === "A") singleArmWidth = isPinArm ? 75 : 100;
    else if (selections['Dimension'] === "E") singleArmWidth = 125;
    else if (selections['Dimension'] === "Z") singleArmWidth = 75;

    const totalArmWidth = singleArmWidth * (parseInt(selections['Number']) || 1);
    const totalRequiredKB = (parseInt(poleWidth) || 0) + totalArmWidth + 60; 
    const kingBoltIdx = BOLT_SIZES.findIndex(s => s >= totalRequiredKB);

    // Steel arms (including LVTX) don't use conical/M20 washers so king bolt is one size down
    const isSteel = selections['Material'] === 'S' || selections['Voltage'] === 'LVTX';
    const steelKingBoltIdx = kingBoltIdx > 0 ? kingBoltIdx - 1 : 0;
    const kingBoltSize = isSteel
      ? BOLT_SIZES[steelKingBoltIdx]
      : (kingBoltIdx !== -1 ? BOLT_SIZES[kingBoltIdx] : BOLT_SIZES[BOLT_SIZES.length - 1]);
    const spacerBoltSize = (kingBoltIdx > 0) ? BOLT_SIZES[kingBoltIdx - 1] : BOLT_SIZES[0];

    const totalRequiredLB = (parseInt(poleWidth) || 0) + 50;
    const braceBoltIdx = BOLT_SIZES.findIndex(s => s >= totalRequiredLB);
    const longBraceBoltSize = braceBoltIdx !== -1 ? BOLT_SIZES[braceBoltIdx] : BOLT_SIZES[BOLT_SIZES.length - 1];

    // LVTX T bracket M16 bolt: poleWidth + 40mm rounded up to nearest bolt size
    const tBracketBoltRequired = (parseInt(poleWidth) || 0) + 40;
    const tBracketBoltIdx = BOLT_SIZES.findIndex(s => s >= tBracketBoltRequired);
    const tBracketBoltSize = tBracketBoltIdx !== -1 ? BOLT_SIZES[tBracketBoltIdx] : BOLT_SIZES[BOLT_SIZES.length - 1];
    
    return { kingBoltSize, spacerBoltSize, longBraceBoltSize, isPinArm, armWidth: totalArmWidth, isSteel, tBracketBoltSize };
  }, [selections, poleWidth]);

  const generatePickList = useCallback((levelSelections, levelPoleWidth, levelBoltSizing) => {
    if (!isFinalized || !levelBoltSizing) return [];
    const { Voltage: voltage, Configuration: config, Material: material, Dimension: dimension, Length: lengthRaw, Number: num, Wires: wiresStr } = selections;
    const armCount = parseInt(num) || 1;
    const isHV = ["11", "33", "66"].includes(voltage);
    const isLVTX = voltage === 'LVTX';
    const isLV = ["LV", "LVTX"].includes(voltage);
    const isEDO = config.includes("EDO");
    const isSteel = material === 'S' || isLVTX;

    const items = [{
      id: `${material}${isHV ? 'HV' : 'LV'}-${config}-${dimension}-${lengthRaw}`,
      name: `${material === 'T' ? '' : MATERIAL_MAP[material] + ' '}${isHV ? 'HV' : 'LV'} ${armCount === 2 ? 'Double' : 'Single'} ${config === "EDO" ? 'DDO Arm' : (levelBoltSizing.isPinArm ? 'Pin Arm' : 'Crossarm')} - ${DIMENSION_MAP[dimension]} x ${(parseInt(lengthRaw)/10).toFixed(1)}m`,
      qty: armCount, category: 'Main Arm'
    }];

    // ── King Bolt Kit ─────────────────────────────────────────────────────────
    // TFLYW/TFLYS mount differently and have their own hardware instead
    if (config !== 'TFLYW' && config !== 'TFLYS') {
      items.push({ id: `BOLT-M16-${levelBoltSizing.kingBoltSize}`, name: `King Bolt (M16x${levelBoltSizing.kingBoltSize}mm)`, qty: 1, category: 'Hardware' });
      items.push({ id: 'WASH-M16-50-KB', name: 'M16x50x50 Square Washer', qty: 2, category: 'Hardware' });
      items.push({ id: 'NUT-M16-KB', name: 'M16 Nut', qty: 1, category: 'Hardware' });
      // Timber arms only: conical washer seats the king bolt against the wood grain
      if (material === 'T') {
        items.push({ id: 'WASH-M20-80', name: 'M20x80x80 Large Washer', qty: 1, category: 'Hardware' });
        items.push({ id: 'WASH-CONICAL', name: 'Conical Washer', qty: 1, category: 'Hardware' });
      }
    }

    // Wire Quantity Calculation
    let baseWireQty = 0;
    if (wiresStr) {
      const wireValue = parseInt(wiresStr);
      if (wireValue < 10) {
        baseWireQty = wireValue;
      } else {
        const digits = wiresStr.split('').map(Number);
        baseWireQty = digits[0] + digits[1];
      }
    }

    // ── LV Logic ───────────────────────────────────────────────────────────────
    // B (Blank Arm) gets no insulators at all
    if (isLV && wiresStr && config !== 'B') {
      if (levelBoltSizing.isPinArm) {
        const finalPinQty = baseWireQty * armCount;
        items.push({ id: 'INS-LV-PIN', name: 'LV Pin Insulator', qty: finalPinQty, category: 'Insulators' });
      } else if (config === "T" || config === "TT" || config.startsWith("TPS") || config === "TFLYW" || config === "TFLYS") {
        // Term qty scales with wire count for both LV and LVTX
        const termQty = baseWireQty * (config === "TT" ? 2 : 1);
        const armSpecificBolt = dimension === "A" ? "110mm" : "130mm";
        
        items.push({ id: 'INS-LV-BOB', name: 'LV Bobbin', qty: termQty, category: 'Insulators' });
        items.push({ id: 'STRAP-SH-7', name: '7" Shackle Strap', qty: termQty * 2, category: 'Hardware' });
        items.push({ id: 'BOLT-M12-110-TS', name: 'M12x110mm Bolt (Term Set)', qty: termQty, category: 'Hardware' });
        items.push({ id: `BOLT-M12-${armSpecificBolt}-ARM`, name: `M12x${armSpecificBolt} Bolt (Arm Side)`, qty: termQty, category: 'Hardware' });
        items.push({ id: 'NUT-M12-TS', name: 'M12 Nut (Term Set)', qty: termQty * 2, category: 'Hardware' });
      }
    }

    // ── HV & LV Insulator Logic (unified via parseConfig) ──────────────────────
    // B (Blank Arm) gets no insulators at all
    if (isHV && config !== 'B') {
      const { termCount, postQty, hasEDO, hasDelta } = parseConfig(config, baseWireQty, armCount);
      const voltageLabel = `${voltage}kV`;

      // EDO Cutout — 1 per wire
      if (hasEDO) {
        items.push({ id: `EDO-${voltage}KV`, name: `${voltageLabel} Expulsion Drop Out (EDO) Cutout`, qty: baseWireQty, category: 'Insulators' });
      }

      // Voltage-specific Post Insulators
      if (postQty > 0) {
        items.push({ id: `INS-POST-${voltage}KV`, name: `${voltageLabel} Post Insulator`, qty: postQty, category: 'Insulators' });
      }

      // HV Term Sets — 1 full set per wire per term
      if (termCount > 0) {
        const termQty = baseWireQty * termCount;
        items.push({ id: 'EYEBOLT-M16-250',         name: 'M16x250mm Eye Bolt',                    qty: termQty, category: 'Hardware' });
        items.push({ id: `INS-TERM-${voltage}KV`,   name: `${voltageLabel} Polymeric Term Insulator`, qty: termQty, category: 'Insulators' });
        items.push({ id: 'CLIP-RFI',                name: 'R.F.I. Clip',                           qty: termQty, category: 'Hardware' });
        items.push({ id: 'CLEVIS',                  name: 'Clevis',                                qty: termQty, category: 'Hardware' });
      }

      // Delta Bracket
      if (hasDelta) {
        items.push({ id: 'BRACKET-DELTA', name: 'Delta Bracket', qty: 1, category: 'Hardware' });
      }
    }

    // ── Timber Arm Braces ─────────────────────────────────────────────────────
    // B (Blank Arm) still gets braces; TFLY variants don't
    if (material === 'T' && config !== 'TFLYW' && config !== 'TFLYS') {
      const braceSize = parseInt(lengthRaw) >= 30 ? "900mm" : "763mm";
      const shortBoltSize = dimension === "A" ? (levelBoltSizing.isPinArm ? "110mm" : "140mm") : (dimension === "E" ? "180mm" : "140mm");
      items.push({ id: `BRACE-${braceSize.substring(0,3)}`, name: `${braceSize} Arm Brace`, qty: isEDO ? 1 : 2, category: 'Hardware' });
      items.push({ id: 'WASH-M12-50', name: 'M12x50x50 Square Washer', qty: isEDO ? 2 : 3, category: 'Hardware' });
      items.push({ id: 'NUT-M12', name: 'M12 Nut', qty: isEDO ? 2 : 3, category: 'Hardware' });
      items.push({ id: `BOLT-M12-${shortBoltSize}`, name: `Short M12x${shortBoltSize} Brace Bolt`, qty: isEDO ? 1 : 2, category: 'Hardware' });
      items.push({ id: `BOLT-M12-${levelBoltSizing.longBraceBoltSize}`, name: `Long M12x${levelBoltSizing.longBraceBoltSize}mm Brace Bolt`, qty: 1, category: 'Hardware' });
    }

    // ── Steel Arm Braces ───────────────────────────────────────────────────────
    // Steel arms (non-LVTX) use adjustable braces instead of fixed timber braces
    if (material === 'S' && !isLVTX && config !== 'TFLYW' && config !== 'TFLYS') {
      items.push({ id: 'BRACE-STEEL-ADJ', name: 'Adjustable Steel Arm Brace', qty: 2, category: 'Hardware' });
      items.push({ id: 'BOLT-M12-ADJ-BRACE', name: 'M12 Adjustable Steel Arm Brace Bolt', qty: 2, category: 'Hardware' });
      items.push({ id: `BOLT-M12-${levelBoltSizing.longBraceBoltSize}`, name: `Long M12x${levelBoltSizing.longBraceBoltSize}mm Brace Bolt`, qty: 1, category: 'Hardware' });
    }

    // ── TFLYW — Termination Fly Arm on Double Wooden Arm ───────────────────────
    if (config === 'TFLYW') {
      const tflyBoltSize = dimension === 'A' ? 240 : 280;
      items.push({ id: 'WASH-M20-80-FLY', name: 'M20x80x80 Large Washer (Fly Arm)', qty: 2, category: 'Hardware' });
      items.push({ id: 'WASH-CONICAL-FLY', name: 'Conical Washer (Fly Arm)', qty: 2, category: 'Hardware' });
      items.push({ id: `BOLT-M16-${tflyBoltSize}-FLY`, name: `M16x${tflyBoltSize}mm Bolt (Fly Arm)`, qty: 2, category: 'Hardware' });
      items.push({ id: 'NUT-M16-FLY', name: 'M16 Nut (Fly Arm)', qty: 2, category: 'Hardware' });
    }

    // ── TFLYS — Termination Fly Arm on Single Steel Arm ─────────────────────────
    if (config === 'TFLYS') {
      const tflysBoltSize = dimension === 'A' ? 240 : 280;
      items.push({ id: 'BRACKET-STEEL-FLY', name: 'Steel Fly Arm Bracket', qty: 1, category: 'Hardware' });
      items.push({ id: 'WASH-M20-80-FLYS', name: 'M20x80x80 Large Washer (Fly Arm)', qty: 1, category: 'Hardware' });
      items.push({ id: 'WASH-CONICAL-FLYS', name: 'Conical Washer (Fly Arm)', qty: 1, category: 'Hardware' });
      items.push({ id: `BOLT-M16-${tflysBoltSize}-FLYS`, name: `M16x${tflysBoltSize}mm Bolt (Fly Arm)`, qty: 1, category: 'Hardware' });
      items.push({ id: 'WASH-M16-50-FLYS', name: 'M16x50x50 Square Washer (Fly Arm)', qty: 2, category: 'Hardware' });
    }

    // ── LVTX Steel T Bracket (replaces braces on LVTX arms) ────────────────────
    if (isLVTX) {
      items.push({ id: 'BRACKET-T-STEEL', name: 'Steel T Bracket', qty: 1, category: 'Hardware' });
      items.push({ id: 'BOLT-M12-140-TB', name: 'M12x140mm Bolt (T Bracket)', qty: 2, category: 'Hardware' });
      items.push({ id: 'WASH-M12-50-TB', name: 'M12x50x50 Square Washer (T Bracket)', qty: 4, category: 'Hardware' });
      items.push({ id: `BOLT-M16-${levelBoltSizing.tBracketBoltSize}-TB`, name: `M16x${levelBoltSizing.tBracketBoltSize}mm Bolt (T Bracket Through-Pole)`, qty: 1, category: 'Hardware' });
      items.push({ id: 'WASH-M16-50-TB', name: 'M16x50x50 Square Washer (T Bracket)', qty: 2, category: 'Hardware' });
    }

    // ── Double Arm Spacer ──────────────────────────────────────────────────────
    // 1× spacer bolt per double arm assembly; pipe is levelPoleWidth − 5mm
    if (armCount === 2) {
      const spacerPipeLength = (parseInt(levelPoleWidth) || 0) - 5;
      items.push({ id: `BOLT-M16-${levelBoltSizing.spacerBoltSize}`, name: `Spacer Bolt (M16x${levelBoltSizing.spacerBoltSize}mm)`, qty: 1, category: 'Hardware' });
      items.push({ id: 'WASH-M16-50-SP', name: 'M16x50x50 Square Washer (Spacer)', qty: 4, category: 'Hardware' });
      items.push({ id: `PIPE-SPACER-${spacerPipeLength}`, name: `Spacer Pipe (${spacerPipeLength}mm)`, qty: 1, category: 'Hardware' });
    }

    return items;
  
    return items;
  }, []);

  // Current level's pick list
  const currentPickList = useMemo(() => {
    if (!boltSizingResult) return [];
    return generatePickList(selections, poleWidth, boltSizingResult);
  }, [selections, poleWidth, boltSizingResult, generatePickList]);

  // Aggregated pick list from all levels
  const aggregatedPickList = useMemo(() => {
    if (!isFinalized) return [];
    
    const itemMap = new Map();
    
    levels.forEach(level => {
      level.pickList.forEach(item => {
        if (itemMap.has(item.id)) {
          const existing = itemMap.get(item.id);
          existing.qty += item.qty;
        } else {
          itemMap.set(item.id, { ...item });
        }
      });
    });
    
    return Array.from(itemMap.values());
  }, [levels, isFinalized]);

  const handleSelect = (option) => {
    setSelections(prev => ({ ...prev, [currentSection]: option }));
    if (activeStep < SECTIONS.length - 1) setActiveStep(activeStep + 1);
    else setShowPoleInput(true);
  };

  const goBack = () => {
    if (showPoleInput) setShowPoleInput(false);
    else if (activeStep > 0) setActiveStep(activeStep - 1);
  };

  const handleLevelComplete = () => {
    // Save current level
    const newLevel = {
      level: currentLevel,
      selections: { ...selections },
      poleWidth: parseInt(poleWidth),
      code: generatedCode,
      pickList: generatePickList(selections, poleWidth, boltSizingResult)
    };
    
    setLevels(prev => [...prev, newLevel]);
    setShowPoleInput(false);
    setShowLevelSummary(true);
  };

  const handleAddAnotherLevel = () => {
    setCurrentLevel(prev => prev + 1);
    setSelections({});
    setActiveStep(0);
    setPoleWidth(150);
    setShowLevelSummary(false);
  };

  const handleFinalizeAll = () => {
    setShowLevelSummary(false);
    setIsFinalized(true);
  };

  const reset = () => { 
    setLevels([]);
    setCurrentLevel(1);
    setSelections({}); 
    setActiveStep(0); 
    setIsFinalized(false); 
    setShowPoleInput(false);
    setShowLevelSummary(false);
    setPoleWidth(150); 
  };



  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <Layers className="text-blue-600" size={28} /> XARM
          </h1>
          <button onClick={reset} className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-500 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all shadow-sm active:scale-95">
            <RefreshCcw size={14} /> RESET
          </button>
        </header>

        {showLevelSummary ? (
          <div className="space-y-6">
            <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden p-8">
              <h2 className="text-2xl font-black text-slate-800 mb-6">Level {currentLevel} Saved</h2>
              <div className="bg-slate-50 rounded-2xl p-6 mb-6">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Build Code</div>
                <div className="text-lg font-mono font-black text-slate-800">{generatedCode}</div>
              </div>
              <div className="space-y-3">
                <button onClick={handleAddAnotherLevel} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2 active:scale-95">
                  Add Level {currentLevel + 1} <ChevronRight />
                </button>
                <button onClick={handleFinalizeAll} className="w-full py-4 bg-slate-800 text-white rounded-2xl font-black text-lg hover:bg-slate-900 transition-all flex items-center justify-center gap-2 active:scale-95">
                  Finalize Pick List ({levels.length} {levels.length === 1 ? 'Level' : 'Levels'})
                </button>
              </div>
            </div>
            
            {levels.length > 0 && (
              <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden p-6">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Configured Levels</h3>
                <div className="space-y-3">
                  {levels.map(level => (
                    <div key={level.level} className="bg-slate-50 rounded-xl p-4">
                      <div className="text-xs font-bold text-blue-600 mb-1">Level {level.level}</div>
                      <div className="text-sm font-mono font-bold text-slate-700">{level.code}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : showPoleInput ? (
          <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden">
            <div className="p-8 border-b border-slate-50 flex items-center gap-4">
              <button onClick={goBack} className="p-2 hover:bg-slate-50 rounded-full transition-colors"><ArrowLeft size={24} /></button>
              <div>
                <h2 className="text-2xl font-black text-slate-800">Pole Width</h2>
                <p className="text-slate-500 text-sm font-medium">Verify diameter for bolt calculations</p>
              </div>
            </div>
            <div className="p-8 space-y-8">
              <div className="relative">
                <input 
                  type="number" 
                  value={poleWidth} 
                  onChange={(e) => setPoleWidth(e.target.value)} 
                  className="w-full text-5xl font-black p-8 bg-slate-50 border-2 border-slate-100 rounded-3xl focus:border-blue-500 focus:outline-none transition-all pr-20" 
                />
                <span className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-300 font-black text-xl">mm</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
                   <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Arm Mounting</div>
                   <div className="text-sm font-bold text-blue-900">King: {boltSizingResult?.kingBoltSize}mm</div>
                   {selections['Number'] === "2" && <div className="text-sm font-bold text-blue-900">Spacer: {boltSizingResult?.spacerBoltSize}mm</div>}
                </div>
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                   <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Brace Hardware</div>
                   <div className="text-sm font-bold text-slate-700">Long Brace: {boltSizingResult?.longBraceBoltSize}mm</div>
                </div>
              </div>
              <button onClick={handleLevelComplete} className="w-full py-6 bg-blue-600 text-white rounded-3xl font-black text-xl hover:bg-blue-700 shadow-xl shadow-blue-100 transition-all flex items-center justify-center gap-3 active:scale-95">
                SAVE LEVEL {currentLevel} <ChevronRight />
              </button>
            </div>
          </div>
        ) : !isFinalized ? (
          <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden min-h-[500px]">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-4">
                {activeStep > 0 && <button onClick={goBack} className="p-2 hover:bg-slate-50 rounded-full transition-colors text-slate-400"><ArrowLeft size={24} /></button>}
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 rounded-full text-xs font-bold text-blue-600 uppercase mb-2">
                    Level {currentLevel}
                  </div>
                  <h2 className="text-2xl font-black text-slate-800 tracking-tight capitalize">{currentSection}</h2>
                  <p className="text-slate-400 text-xs font-bold tracking-widest uppercase mt-1">Step {activeStep + 1} of {SECTIONS.length}</p>
                </div>
              </div>
            </div>
            <div className="p-8 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {options.map((option) => (
                <button key={option} onClick={() => handleSelect(option)} className="group p-6 rounded-2xl border-2 border-slate-100 hover:border-blue-500 hover:bg-blue-50 transition-all active:scale-95 text-center">
                  <div className="text-xl font-black text-slate-800 group-hover:text-blue-600">{option}</div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-slate-900 rounded-[2rem] p-10 text-white relative overflow-hidden">
              <div className="relative z-10">
                <div className="text-blue-400 text-[10px] font-black uppercase tracking-[0.3em] mb-2">Build Identifier</div>
                <div className="text-2xl sm:text-3xl lg:text-4xl font-mono font-black tracking-tighter mb-4 truncate whitespace-nowrap leading-tight">
                  {generatedCode}
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-[10px] font-bold border border-white/10 uppercase">Pole: {poleWidth}mm</div>
              </div>
            </div>
            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="font-black flex items-center gap-2 text-slate-800 uppercase text-sm tracking-tight"><ClipboardList size={18} className="text-blue-600" /> Aggregated Pick List</h3>
                <div className="text-xs text-slate-500 font-bold">{levels.length} {levels.length === 1 ? 'Level' : 'Levels'}</div>
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
                    {Object.entries((() => {
                      const groups = {};
                      aggregatedPickList.forEach(item => {
                        if (!groups[item.category]) groups[item.category] = [];
                        groups[item.category].push(item);
                      });
                      return groups;
                    })()).map(([category, categoryItems]) => (
                      <React.Fragment key={category}>
                        <tr className="bg-slate-50/80">
                          <td colSpan={3} className="px-5 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">{category}</td>
                        </tr>
                        {categoryItems.map((item, i) => (
                          <tr key={i} className="hover:bg-slate-50/50 transition-colors border-t border-slate-50">
                            <td className="p-5 font-mono text-[11px] font-bold text-slate-500">{item.id}</td>
                            <td className="p-5 text-slate-800 text-xs font-bold uppercase">{item.name}</td>
                            <td className="p-5 text-right font-black text-slate-900 text-sm">{item.qty}</td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
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

