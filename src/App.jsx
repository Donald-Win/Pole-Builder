import React, { useState, useMemo, useCallback } from 'react';
import { Layers, ArrowLeft, ChevronRight, ClipboardList, RefreshCcw } from 'lucide-react';

// ════════════════════════════════════════════════════════════════════════════
// XARM CONFIGURATION DATA
// ════════════════════════════════════════════════════════════════════════════

const SECTIONS = ['Voltage', 'Configuration', 'Dimension', 'Length', 'Number', 'Material', 'Wires'];

const CONFIG_DATA = {
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

const POLE_CONFIG_DATA = {
  Length: ['75', '90', '95', '100', '105', '110', '115', '120', '124', '125', '136', '148', '155', '185'],
  Number: ['S', 'D', 'H'],
  Manufacturer: ['B', 'D', 'H', 'G', 'I', 'GP', 'HW'],
  Material: ['C', 'F', 'G', 'H', 'P', 'PH', 'S', 'SL']
};

const POLE_NUMBER_MAP = { S: 'Single', D: 'Double', H: 'H-Structure' };
const POLE_MANUFACTURER_MAP = {
  B: 'Busck', D: 'Dulhunty', H: 'Hume', G: 'Industrial Galvanisers',
  I: 'International Utility Poles', GP: 'Goldpine Electropoles', HW: 'Hardwood Poles'
};
const POLE_MATERIAL_MAP = {
  C: 'Reinforced Concrete', F: 'Glass Fibre Reinforced Concrete', G: 'Galvanised Steel',
  H: 'Hardwood', P: 'Prestressed Concrete', PH: 'Prestressed Heavy Concrete',
  S: 'Softwood (12kN)', SL: 'Softwood Light (9kN)'
};

// ════════════════════════════════════════════════════════════════════════════
// CONFIGURATION PARSER
// ════════════════════════════════════════════════════════════════════════════

const parseConfig = (config, baseWireQty, armCount) => {
  if (!config) return { termCount: 0, postQty: 0, hasEDO: false, hasDelta: false };
  
  const termCount = (config.match(/T/g) || []).length;
  const postMatch = config.match(/\d+/);
  const postQty = postMatch
    ? parseInt(postMatch[0])
    : (config.includes('PS') ? baseWireQty * armCount : 0);
  const hasEDO = config.includes('EDO');
  const hasDelta = config.startsWith('D');

  return { termCount, postQty, hasEDO, hasDelta };
};

// ════════════════════════════════════════════════════════════════════════════
// MAIN APP COMPONENT
// ════════════════════════════════════════════════════════════════════════════

const App = () => {
  // Class selection
  const [selectedClass, setSelectedClass] = useState(null); // 'POLE' or 'XARM'
  
  // Items storage
  const [poles, setPoles] = useState([]);
  const [levels, setLevels] = useState([]);
  const [currentPole, setCurrentPole] = useState(1);
  const [currentLevel, setCurrentLevel] = useState(1);
  
  // Current wizard state
  const [selections, setSelections] = useState({});
  const [activeStep, setActiveStep] = useState(0);
  const [poleWidth, setPoleWidth] = useState(150);
  const [completedWizardSelections, setCompletedWizardSelections] = useState({});
  
  // UI state
  const [showPoleInput, setShowPoleInput] = useState(false);
  const [showItemSummary, setShowItemSummary] = useState(false);
  const [isFinalized, setIsFinalized] = useState(false);
  const [justSavedCode, setJustSavedCode] = useState('');

  // Current configuration context
  const sections = selectedClass === 'XARM' ? SECTIONS : POLE_SECTIONS;
  const configData = selectedClass === 'XARM' ? CONFIG_DATA : POLE_CONFIG_DATA;
  const currentSection = sections[activeStep];
  const options = configData[currentSection] || [];

  // Generated code
  const generatedCode = useMemo(() => {
    if (!selectedClass) return '';
    const prefix = selectedClass === 'XARM' ? 'XARM' : 'POLE';
    return `${prefix}-${sections.map(s => selections[s] || '—').join('-')}`;
  }, [selectedClass, selections, sections]);

  // Bolt sizing for XARM
  const boltSizingResult = useMemo(() => {
    if (selectedClass !== 'XARM' || !selections['Dimension']) return null;
    
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

    const isSteel = selections['Material'] === 'S' || selections['Voltage'] === 'LVTX';
    const steelKingBoltIdx = kingBoltIdx > 0 ? kingBoltIdx - 1 : 0;
    const kingBoltSize = isSteel
      ? BOLT_SIZES[steelKingBoltIdx]
      : (kingBoltIdx !== -1 ? BOLT_SIZES[kingBoltIdx] : BOLT_SIZES[BOLT_SIZES.length - 1]);
    const spacerBoltSize = (kingBoltIdx > 0) ? BOLT_SIZES[kingBoltIdx - 1] : BOLT_SIZES[0];

    const totalRequiredLB = (parseInt(poleWidth) || 0) + 50;
    const braceBoltIdx = BOLT_SIZES.findIndex(s => s >= totalRequiredLB);
    const longBraceBoltSize = braceBoltIdx !== -1 ? BOLT_SIZES[braceBoltIdx] : BOLT_SIZES[BOLT_SIZES.length - 1];

    const tBracketBoltRequired = (parseInt(poleWidth) || 0) + 40;
    const tBracketBoltIdx = BOLT_SIZES.findIndex(s => s >= tBracketBoltRequired);
    const tBracketBoltSize = tBracketBoltIdx !== -1 ? BOLT_SIZES[tBracketBoltIdx] : BOLT_SIZES[BOLT_SIZES.length - 1];
    
    return { kingBoltSize, spacerBoltSize, longBraceBoltSize, isPinArm, armWidth: totalArmWidth, isSteel, tBracketBoltSize };
  }, [selectedClass, selections, poleWidth]);

  // Generate XARM pick list
  const generatePickList = useCallback((levelSelections, levelPoleWidth, levelBoltSizing) => {
    if (!levelBoltSizing || !levelSelections.Configuration) return [];
    
    const { Voltage: voltage, Configuration: config, Material: material, Dimension: dimension, Length: lengthRaw, Number: num, Wires: wiresStr } = levelSelections;
    const armCount = parseInt(num) || 1;
    const isHV = ["11", "33", "66"].includes(voltage);
    const isLVTX = voltage === 'LVTX';
    const isLV = ["LV", "LVTX"].includes(voltage);
    const isEDO = config.includes("EDO");
    const isSteel = material === 'S' || isLVTX;

    const items = [{
      id: `${material}${isHV ? 'HV' : 'LV'}-${config}-${dimension}-${lengthRaw}`,
      name: `${material === 'T' ? '' : MATERIAL_MAP[material] + ' '}${isHV ? 'HV' : 'LV'} ${armCount === 2 ? 'Double' : 'Single'} ${config === "EDO" ? 'DDO Arm' : (levelBoltSizing.isPinArm ? 'Pin Arm' : 'Crossarm')} - ${DIMENSION_MAP[dimension]} x ${(parseInt(lengthRaw)/10).toFixed(1)}m`,
      qty: armCount,
      category: 'Main Arm'
    }];

    // King bolt kit (exclude TFLYW/TFLYS)
    if (config !== 'TFLYW' && config !== 'TFLYS') {
      items.push({ id: `BOLT-M16-${levelBoltSizing.kingBoltSize}`, name: `King Bolt (M16x${levelBoltSizing.kingBoltSize}mm)`, qty: 1, category: 'Hardware' });
      items.push({ id: 'WASH-M16-50-KB', name: 'M16x50x50 Square Washer', qty: 2, category: 'Hardware' });
      items.push({ id: 'NUT-M16-KB', name: 'M16 Nut', qty: 1, category: 'Hardware' });
      
      if (material === 'T') {
        items.push({ id: 'WASH-M20-80', name: 'M20x80x80 Large Washer', qty: 1, category: 'Hardware' });
        items.push({ id: 'WASH-CONICAL', name: 'Conical Washer', qty: 1, category: 'Hardware' });
      }
    }

    // Wire quantity calculation
    let baseWireQty = 0;
    if (wiresStr) {
      const wireValue = parseInt(wiresStr);
      baseWireQty = wireValue < 10 ? wireValue : wiresStr.split('').map(Number).reduce((a, b) => a + b, 0);
    }

    // LV insulators (skip for B config)
    if (isLV && wiresStr && config !== 'B') {
      if (levelBoltSizing.isPinArm) {
        const finalPinQty = baseWireQty * armCount;
        items.push({ id: 'INS-LV-PIN', name: 'LV Pin Insulator', qty: finalPinQty, category: 'Insulators' });
      } else if (config === "T" || config === "TT" || config.startsWith("TPS") || config === "TFLYW" || config === "TFLYS") {
        const termQty = baseWireQty * (config === "TT" ? 2 : 1);
        const armSpecificBolt = dimension === "A" ? "110mm" : "130mm";
        
        items.push({ id: 'INS-LV-BOB', name: 'LV Bobbin', qty: termQty, category: 'Insulators' });
        items.push({ id: 'STRAP-SH-7', name: '7" Shackle Strap', qty: termQty * 2, category: 'Hardware' });
        items.push({ id: 'BOLT-M12-110-TS', name: 'M12x110mm Bolt (Term Set)', qty: termQty, category: 'Hardware' });
        items.push({ id: `BOLT-M12-${armSpecificBolt}-ARM`, name: `M12x${armSpecificBolt} Bolt (Arm Side)`, qty: termQty, category: 'Hardware' });
        items.push({ id: 'NUT-M12-TS', name: 'M12 Nut (Term Set)', qty: termQty * 2, category: 'Hardware' });
      }
    }

    // HV insulators (skip for B config)
    if (isHV && config !== 'B') {
      const { termCount, postQty, hasEDO, hasDelta } = parseConfig(config, baseWireQty, armCount);
      const voltageLabel = `${voltage}kV`;

      if (hasEDO) {
        items.push({ id: `EDO-${voltage}KV`, name: `${voltageLabel} Expulsion Drop Out (EDO) Cutout`, qty: baseWireQty, category: 'Insulators' });
      }

      if (postQty > 0) {
        items.push({ id: `INS-POST-${voltage}KV`, name: `${voltageLabel} Post Insulator`, qty: postQty, category: 'Insulators' });
      }

      if (termCount > 0) {
        const termQty = baseWireQty * termCount;
        items.push({ id: 'EYEBOLT-M16-250', name: 'M16x250mm Eye Bolt', qty: termQty, category: 'Hardware' });
        items.push({ id: `INS-TERM-${voltage}KV`, name: `${voltageLabel} Polymeric Term Insulator`, qty: termQty, category: 'Insulators' });
        items.push({ id: 'CLIP-RFI', name: 'R.F.I. Clip', qty: termQty, category: 'Hardware' });
        items.push({ id: 'CLEVIS', name: 'Clevis', qty: termQty, category: 'Hardware' });
      }

      if (hasDelta) {
        items.push({ id: 'BRACKET-DELTA', name: 'Delta Bracket', qty: 1, category: 'Hardware' });
      }
    }

    // Timber arm braces
    if (material === 'T' && config !== 'TFLYW' && config !== 'TFLYS') {
      const braceSize = parseInt(lengthRaw) >= 30 ? "900mm" : "763mm";
      const shortBoltSize = dimension === "A" ? (levelBoltSizing.isPinArm ? "110mm" : "140mm") : (dimension === "E" ? "180mm" : "140mm");
      
      items.push({ id: `BRACE-${braceSize.substring(0,3)}`, name: `${braceSize} Arm Brace`, qty: isEDO ? 1 : 2, category: 'Hardware' });
      items.push({ id: 'WASH-M12-50', name: 'M12x50x50 Square Washer', qty: isEDO ? 2 : 3, category: 'Hardware' });
      items.push({ id: 'NUT-M12', name: 'M12 Nut', qty: isEDO ? 2 : 3, category: 'Hardware' });
      items.push({ id: `BOLT-M12-${shortBoltSize}`, name: `Short M12x${shortBoltSize} Brace Bolt`, qty: isEDO ? 1 : 2, category: 'Hardware' });
      items.push({ id: `BOLT-M12-${levelBoltSizing.longBraceBoltSize}`, name: `Long M12x${levelBoltSizing.longBraceBoltSize}mm Brace Bolt`, qty: 1, category: 'Hardware' });
    }

    // Steel arm braces
    if (material === 'S' && !isLVTX && config !== 'TFLYW' && config !== 'TFLYS') {
      items.push({ id: 'BRACE-STEEL-ADJ', name: 'Adjustable Steel Arm Brace', qty: 2, category: 'Hardware' });
      items.push({ id: 'BOLT-M12-ADJ-BRACE', name: 'M12 Adjustable Steel Arm Brace Bolt', qty: 2, category: 'Hardware' });
      items.push({ id: `BOLT-M12-${levelBoltSizing.longBraceBoltSize}`, name: `Long M12x${levelBoltSizing.longBraceBoltSize}mm Brace Bolt`, qty: 1, category: 'Hardware' });
    }

    // TFLYW hardware
    if (config === 'TFLYW') {
      const tflyBoltSize = dimension === 'A' ? 240 : 280;
      items.push({ id: 'WASH-M20-80-FLY', name: 'M20x80x80 Large Washer (Fly Arm)', qty: 2, category: 'Hardware' });
      items.push({ id: 'WASH-CONICAL-FLY', name: 'Conical Washer (Fly Arm)', qty: 2, category: 'Hardware' });
      items.push({ id: `BOLT-M16-${tflyBoltSize}-FLY`, name: `M16x${tflyBoltSize}mm Bolt (Fly Arm)`, qty: 2, category: 'Hardware' });
      items.push({ id: 'NUT-M16-FLY', name: 'M16 Nut (Fly Arm)', qty: 2, category: 'Hardware' });
    }

    // TFLYS hardware
    if (config === 'TFLYS') {
      const tflysBoltSize = dimension === 'A' ? 240 : 280;
      items.push({ id: 'BRACKET-STEEL-FLY', name: 'Steel Fly Arm Bracket', qty: 1, category: 'Hardware' });
      items.push({ id: 'WASH-M20-80-FLYS', name: 'M20x80x80 Large Washer (Fly Arm)', qty: 1, category: 'Hardware' });
      items.push({ id: 'WASH-CONICAL-FLYS', name: 'Conical Washer (Fly Arm)', qty: 1, category: 'Hardware' });
      items.push({ id: `BOLT-M16-${tflysBoltSize}-FLYS`, name: `M16x${tflysBoltSize}mm Bolt (Fly Arm)`, qty: 1, category: 'Hardware' });
      items.push({ id: 'WASH-M16-50-FLYS', name: 'M16x50x50 Square Washer (Fly Arm)', qty: 2, category: 'Hardware' });
    }

    // LVTX T bracket
    if (isLVTX) {
      items.push({ id: 'BRACKET-T-STEEL', name: 'Steel T Bracket', qty: 1, category: 'Hardware' });
      items.push({ id: 'BOLT-M12-140-TB', name: 'M12x140mm Bolt (T Bracket)', qty: 2, category: 'Hardware' });
      items.push({ id: 'WASH-M12-50-TB', name: 'M12x50x50 Square Washer (T Bracket)', qty: 4, category: 'Hardware' });
      items.push({ id: `BOLT-M16-${levelBoltSizing.tBracketBoltSize}-TB`, name: `M16x${levelBoltSizing.tBracketBoltSize}mm Bolt (T Bracket Through-Pole)`, qty: 1, category: 'Hardware' });
      items.push({ id: 'WASH-M16-50-TB', name: 'M16x50x50 Square Washer (T Bracket)', qty: 2, category: 'Hardware' });
    }

    // Double arm spacer
    if (armCount === 2) {
      const spacerPipeLength = (parseInt(levelPoleWidth) || 0) - 5;
      items.push({ id: `BOLT-M16-${levelBoltSizing.spacerBoltSize}`, name: `Spacer Bolt (M16x${levelBoltSizing.spacerBoltSize}mm)`, qty: 1, category: 'Hardware' });
      items.push({ id: 'WASH-M16-50-SP', name: 'M16x50x50 Square Washer (Spacer)', qty: 4, category: 'Hardware' });
      items.push({ id: `PIPE-SPACER-${spacerPipeLength}`, name: `Spacer Pipe (${spacerPipeLength}mm)`, qty: 1, category: 'Hardware' });
    }

    return items;
  }, []);

  // Generate POLE pick list
  const generatePolePickList = useCallback((poleSelections) => {
    if (!poleSelections.Length || !poleSelections.Number || !poleSelections.Manufacturer || !poleSelections.Material) {
      return [];
    }

    const { Length: lengthCode, Number: num, Manufacturer: mfr, Material: mat } = poleSelections;
    const items = [];

    // The pole(s)
    const poleQty = num === 'S' ? 1 : 2;
    const lengthMeters = (parseInt(lengthCode) / 10).toFixed(1);
    const poleName = `${lengthMeters}m ${POLE_MANUFACTURER_MAP[mfr]} ${POLE_MATERIAL_MAP[mat]} Pole`;
    
    items.push({ id: `POLE-${lengthCode}-${num}-${mfr}-${mat}`, name: poleName, qty: poleQty, category: 'Pole' });

    // Breast blocks
    if (num === 'S') {
      items.push({ id: 'BREAST-PLASTIC', name: 'Plastic Breast Block', qty: 2, category: 'Pole Hardware' });
    } else if (num === 'D') {
      items.push({ id: 'BREAST-CONCRETE', name: 'Concrete Breast Block', qty: 2, category: 'Pole Hardware' });
    } else if (num === 'H') {
      items.push({ id: 'BREAST-PLASTIC', name: 'Plastic Breast Block', qty: 4, category: 'Pole Hardware' });
    }

    // Donuts
    if (num === 'S' && mfr === 'B') {
      items.push({ id: 'DONUT-PLASTIC-POLE', name: 'Plastic Pole Donut', qty: 1, category: 'Pole Hardware' });
    } else if (num === 'D' && mfr === 'B') {
      items.push({ id: 'DONUT-CONCRETE-DOUBLE', name: 'Concrete Double Donut', qty: 1, category: 'Pole Hardware' });
    }

    return items;
  }, []);

  // Aggregated pick list
  const aggregatedPickList = useMemo(() => {
    if (!isFinalized) return [];
    
    const itemMap = new Map();
    
    // Add all poles
    poles.forEach(pole => {
      pole.pickList.forEach(item => {
        if (itemMap.has(item.id)) {
          itemMap.get(item.id).qty += item.qty;
        } else {
          itemMap.set(item.id, { ...item });
        }
      });
    });
    
    // Add all crossarms
    levels.forEach(level => {
      level.pickList.forEach(item => {
        if (itemMap.has(item.id)) {
          itemMap.get(item.id).qty += item.qty;
        } else {
          itemMap.set(item.id, { ...item });
        }
      });
    });
    
    return Array.from(itemMap.values());
  }, [poles, levels, isFinalized]);

  const groupedAggregatedPickList = useMemo(() => {
    const groups = {};
    aggregatedPickList.forEach(item => {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    });
    return groups;
  }, [aggregatedPickList]);

  // Event handlers
  const handleClassSelect = (classType) => {
    setSelectedClass(classType);
    setSelections({});
    setActiveStep(0);
  };

  const handleSelect = (option) => {
    setSelections(prev => ({ ...prev, [currentSection]: option }));
    
    if (activeStep < sections.length - 1) {
      setActiveStep(activeStep + 1);
    } else if (selectedClass === 'XARM') {
      setCompletedWizardSelections(updatedSelections);
      setShowPoleInput(true);
    } else {
      // POLE: complete immediately
      handleItemComplete();
    }
  };

  const goBack = () => {
    if (showPoleInput) {
      setShowPoleInput(false);
    } else if (activeStep > 0) {
      setActiveStep(activeStep - 1);
    } else {
      setSelectedClass(null);
    }
  };

  const handleItemComplete = () => {
    if (selectedClass === 'XARM') {
      const newLevel = {
        level: currentLevel,
        selections: { ...selections },
        poleWidth: parseInt(poleWidth),
        code: generatedCode,
        pickList: generatePickList(selections, poleWidth, boltSizingResult)
      };
      setLevels(prev => [...prev, newLevel]);
      setCurrentLevel(prev => prev + 1);
    } else if (selectedClass === 'POLE') {
      const newPole = {
        pole: currentPole,
        selections: { ...selections },
        code: generatedCode,
        pickList: generatePolePickList(selections)
      };
      setPoles(prev => [...prev, newPole]);
      setCurrentPole(prev => prev + 1);
    }
    
    setSelections({});
    setActiveStep(0);
    setShowPoleInput(false);
    setShowItemSummary(true);
    setPoleWidth(150);
  };

  const handleAddAnother = () => {
    setSelectedClass(null);
    setShowItemSummary(false);
  };

  const handleFinalizeAll = () => {
    setShowItemSummary(false);
    setIsFinalized(true);
  };

  const reset = () => {
    setSelectedClass(null);
    setPoles([]);
    setLevels([]);
    setCurrentPole(1);
    setCurrentLevel(1);
    setSelections({});
    setCompletedWizardSelections({});
    setActiveStep(0);
    setShowPoleInput(false);
    setShowItemSummary(false);
    setIsFinalized(false);
    setPoleWidth(150);
    setJustSavedCode('');
  };

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════

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

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* CLASS SELECTION */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {!selectedClass && !isFinalized && !showItemSummary ? (
          <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden">
            <div className="p-8 border-b border-slate-50">
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">Choose Component Class</h2>
              <p className="text-slate-400 text-xs font-bold tracking-widest uppercase mt-1">Select what you want to configure</p>
            </div>
            <div className="p-8 grid grid-cols-2 gap-4">
              <button
                onClick={() => handleClassSelect('POLE')}
                className="group relative p-8 bg-slate-50 hover:bg-blue-50 border-2 border-slate-50 hover:border-blue-500 rounded-2xl transition-all active:scale-95"
              >
                <div className="text-3xl font-black text-slate-800 group-hover:text-blue-600 transition-colors mb-2">POLE</div>
                <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Pole Configuration</div>
              </button>
              <button
                onClick={() => handleClassSelect('XARM')}
                className="group relative p-8 bg-slate-50 hover:bg-blue-50 border-2 border-slate-50 hover:border-blue-500 rounded-2xl transition-all active:scale-95"
              >
                <div className="text-3xl font-black text-slate-800 group-hover:text-blue-600 transition-colors mb-2">XARM</div>
                <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Crossarm Configuration</div>
              </button>
            </div>
          </div>
        ) : showItemSummary ? (
          /* ═══════════════════════════════════════════════════════════════ */
          /* ITEM SUMMARY */
          /* ═══════════════════════════════════════════════════════════════ */
          <div className="space-y-6">
            <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden p-8">
              <h2 className="text-2xl font-black text-slate-800 mb-6">
                {selectedClass === 'POLE' ? `Pole ${currentPole - 1} Saved` : `Level ${currentLevel - 1} Saved`}
              </h2>
              <div className="bg-slate-900 rounded-2xl p-6 mb-6 text-white">
                <div className="text-blue-400 text-xs font-black uppercase tracking-widest mb-2">Build Code</div>
                <div className="text-xl font-mono font-black">{generatedCode}</div>
              </div>
              <div className="space-y-3">
                <button onClick={handleAddAnother} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2 active:scale-95">
                  Add Another Component <ChevronRight />
                </button>
                <button onClick={handleFinalizeAll} className="w-full py-4 bg-slate-800 text-white rounded-2xl font-black text-lg hover:bg-slate-900 transition-all flex items-center justify-center gap-2 active:scale-95">
                  Finalize Pick List ({poles.length} {poles.length === 1 ? 'Pole' : 'Poles'}, {levels.length} {levels.length === 1 ? 'Level' : 'Levels'})
                </button>
              </div>
            </div>

            {(poles.length > 0 || levels.length > 0) && (
              <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden p-6">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Configured Items</h3>
                <div className="space-y-3">
                  {poles.map(pole => (
                    <div key={pole.pole} className="bg-slate-50 rounded-xl p-4">
                      <div className="text-xs font-bold text-slate-600 mb-1">Pole {pole.pole}</div>
                      <div className="text-sm font-mono font-bold text-slate-800">{pole.code}</div>
                    </div>
                  ))}
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
        ) : isFinalized ? (
          /* ═══════════════════════════════════════════════════════════════ */
          /* FINAL SCREEN */
          /* ═══════════════════════════════════════════════════════════════ */
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
            {poles.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Poles</h3>
                {poles.map(pole => (
                  <div key={pole.pole} className="bg-slate-900 rounded-2xl p-6 text-white">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-blue-400 text-xs font-black uppercase tracking-widest">Pole {pole.pole}</div>
                    </div>
                    <div className="text-lg font-mono font-black tracking-tight">{pole.code}</div>
                  </div>
                ))}
              </div>
            )}

            {levels.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Crossarms</h3>
                {levels.map(level => (
                  <div key={level.level} className="bg-slate-900 rounded-2xl p-6 text-white">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-blue-400 text-xs font-black uppercase tracking-widest">Level {level.level}</div>
                      <div className="text-xs text-slate-400 font-bold">Pole: {level.poleWidth}mm</div>
                    </div>
                    <div className="text-lg font-mono font-black tracking-tight">{level.code}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="font-black flex items-center gap-2 text-slate-800 uppercase text-sm tracking-tight">
                  <ClipboardList size={18} className="text-blue-600" /> Aggregated Pick List
                </h3>
                <div className="text-xs text-slate-500 font-bold">
                  {poles.length} {poles.length === 1 ? 'Pole' : 'Poles'}, {levels.length} {levels.length === 1 ? 'Level' : 'Levels'}
                </div>
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
                      <tr>
                        <td colSpan={3} className="p-8 text-center text-slate-400 text-sm">No items in pick list</td>
                      </tr>
                    ) : Object.entries(groupedAggregatedPickList).map(([category, categoryItems]) => (
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
        ) : showPoleInput ? (
          /* ═══════════════════════════════════════════════════════════════ */
          /* POLE WIDTH INPUT (XARM only) */
          /* ═══════════════════════════════════════════════════════════════ */
          <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button onClick={goBack} className="p-2 hover:bg-slate-50 rounded-full transition-colors text-slate-400">
                  <ArrowLeft size={24} />
                </button>
                <div>
                  <h2 className="text-2xl font-black text-slate-800 tracking-tight">Pole Width</h2>
                  <p className="text-slate-400 text-xs font-bold tracking-widest uppercase mt-1">Enter the pole diameter at mounting height</p>
                </div>
              </div>
            </div>

            <div className="p-8 space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-2">Pole Width (mm)</label>
                <input
                  type="number"
                  value={poleWidth}
                  onChange={(e) => setPoleWidth(e.target.value)}
                  className="w-full px-6 py-4 text-2xl font-mono font-black text-slate-800 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:border-blue-500 focus:outline-none transition-colors"
                />
              </div>

              {boltSizingResult && (
                <div className="bg-blue-50 rounded-2xl p-4 border-2 border-blue-100">
                  <div className="text-[10px] text-blue-600 font-black uppercase tracking-widest mb-2">Calculated Sizes</div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-xs text-slate-500 font-bold mb-1">King Bolt</div>
                      <div className="text-sm font-bold text-blue-900">{boltSizingResult.kingBoltSize}mm</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 font-bold mb-1">Spacer</div>
                      <div className="text-sm font-bold text-blue-900">{boltSizingResult.spacerBoltSize}mm</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 font-bold mb-1">Brace</div>
                      <div className="text-sm font-bold text-blue-900">{boltSizingResult.longBraceBoltSize}mm</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-slate-900 rounded-2xl p-6 text-white">
                <div className="text-blue-400 text-xs font-black uppercase tracking-widest mb-2">Building</div>
                <div className="text-lg font-mono font-black">{generatedCode}</div>
              </div>

              <button onClick={handleItemComplete} className="w-full py-6 bg-blue-600 text-white rounded-3xl font-black text-xl hover:bg-blue-700 shadow-xl shadow-blue-100 transition-all flex items-center justify-center gap-3 active:scale-95">
                SAVE LEVEL {currentLevel} <ChevronRight />
              </button>
            </div>
          </div>
        ) : (
          /* ═══════════════════════════════════════════════════════════════ */
          /* CONFIGURATION WIZARD */
          /* ═══════════════════════════════════════════════════════════════ */
          <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-4">
                {(activeStep > 0 || selectedClass) && (
                  <button onClick={goBack} className="p-2 hover:bg-slate-50 rounded-full transition-colors text-slate-400">
                    <ArrowLeft size={24} />
                  </button>
                )}
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 rounded-full text-xs font-bold text-blue-600 uppercase mb-2">
                    {selectedClass === 'POLE' ? `Pole ${currentPole}` : `Level ${currentLevel}`}
                  </div>
                  <h2 className="text-2xl font-black text-slate-800 tracking-tight capitalize">{currentSection}</h2>
                  <p className="text-slate-400 text-xs font-bold tracking-widest uppercase mt-1">
                    Step {activeStep + 1} of {sections.length}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-8">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {options.map(option => (
                  <button
                    key={option}
                    onClick={() => handleSelect(option)}
                    className="group relative p-6 bg-slate-50 hover:bg-blue-50 border-2 border-slate-50 hover:border-blue-500 rounded-2xl transition-all active:scale-95"
                  >
                    <div className="text-2xl font-black text-slate-800 group-hover:text-blue-600 transition-colors mb-1">{option}</div>
                    <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                      {selectedClass === 'POLE' && currentSection === 'Number' && POLE_NUMBER_MAP[option]}
                      {selectedClass === 'POLE' && currentSection === 'Manufacturer' && POLE_MANUFACTURER_MAP[option]}
                      {selectedClass === 'POLE' && currentSection === 'Material' && POLE_MATERIAL_MAP[option]}
                      {selectedClass === 'POLE' && currentSection === 'Length' && `${(parseInt(option)/10).toFixed(1)}m`}
                      {selectedClass === 'XARM' && currentSection === 'Dimension' && DIMENSION_MAP[option]}
                      {selectedClass === 'XARM' && currentSection === 'Material' && MATERIAL_MAP[option]}
                    </div>
                  </button>
                ))}
              </div>

              {Object.keys(selections).length > 0 && (
                <div className="mt-6 p-4 bg-slate-900 rounded-2xl">
                  <div className="text-xs text-blue-400 font-black uppercase tracking-widest mb-2">Building</div>
                  <div className="text-lg font-mono font-black text-white">{generatedCode}</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;

