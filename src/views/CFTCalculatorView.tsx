import { useState } from 'react';
import { 
  Calculator, Plus, Trash2, CheckCircle2, AlertTriangle, 
  Layers, Ruler, Clipboard, CheckSquare, Square
} from 'lucide-react';
import type { CftCalculation } from '../db/db';

interface CFTCalculatorViewProps {
  cftCalculations: CftCalculation[];
  addCftCalculation: (calc: Omit<CftCalculation, 'id' | 'branchId' | 'createdAt'>) => Promise<any>;
  deleteCftCalculation: (id: number) => Promise<any>;
  clearCftCalculations: () => Promise<any>;
}

export function CFTCalculatorView({
  cftCalculations,
  addCftCalculation,
  deleteCftCalculation,
  clearCftCalculations
}: CFTCalculatorViewProps) {
  // Input Form States
  const [label, setLabel] = useState('');
  const [thickness, setThickness] = useState('4');
  const [thicknessUnit, setThicknessUnit] = useState<'inches' | 'feet' | 'cm'>('inches');
  const [width, setWidth] = useState('2');
  const [widthUnit, setWidthUnit] = useState<'inches' | 'feet' | 'cm'>('inches');
  const [length, setLength] = useState('5');
  const [lengthUnit, setLengthUnit] = useState<'inches' | 'feet' | 'cm'>('feet');
  const [quantity, setQuantity] = useState('1');

  // Selected Log IDs for combined calculation
  const [selectedLogIds, setSelectedLogIds] = useState<number[]>([]);

  // Toast / Confirmation States
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const triggerConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmModal(null);
      }
    });
  };

  // Convert any unit to Feet
  const convertToFeet = (value: number, unit: 'inches' | 'feet' | 'cm'): number => {
    if (isNaN(value) || value <= 0) return 0;
    if (unit === 'feet') return value;
    if (unit === 'inches') return value / 12;
    if (unit === 'cm') return value / 30.48; // 1 foot = 30.48 cm
    return 0;
  };

  // Real-time calculations
  const tVal = parseFloat(thickness) || 0;
  const wVal = parseFloat(width) || 0;
  const lVal = parseFloat(length) || 0;
  const qVal = parseInt(quantity) || 1;

  const tFeet = convertToFeet(tVal, thicknessUnit);
  const wFeet = convertToFeet(wVal, widthUnit);
  const lFeet = convertToFeet(lVal, lengthUnit);

  const calculatedCftPerPiece = tFeet * wFeet * lFeet;
  const calculatedTotalCft = calculatedCftPerPiece * qVal;

  // Sync / Toggle Checklist Selection
  const handleToggleLog = (id: number) => {
    setSelectedLogIds(prev => 
      prev.includes(id) 
        ? prev.filter(lid => lid !== id) 
        : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    setSelectedLogIds(cftCalculations.map(c => c.id!).filter(Boolean));
  };

  const handleClearSelection = () => {
    setSelectedLogIds([]);
  };

  // Calculation operations
  const handleSaveCalculation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (calculatedTotalCft <= 0) {
      showToast('error', 'Cannot save a zero or negative volume.');
      return;
    }

    try {
      await addCftCalculation({
        label: label.trim() || 'Unlabelled Timber',
        thickness: tVal,
        thicknessUnit,
        width: wVal,
        widthUnit,
        length: lVal,
        lengthUnit,
        quantity: qVal,
        cftPerPiece: Number(calculatedCftPerPiece.toFixed(3)),
        totalCft: Number(calculatedTotalCft.toFixed(3))
      });

      showToast('success', 'Calculation logged in history!');
      // Reset label but keep inputs for sequential logging
      setLabel('');
    } catch (err) {
      console.error(err);
      showToast('error', 'Failed to save calculation.');
    }
  };

  const handleDeleteLog = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteCftCalculation(id);
    setSelectedLogIds(prev => prev.filter(lid => lid !== id));
  };

  const handleClearAllHistory = () => {
    triggerConfirm(
      'Clear Calculation History',
      'Are you sure you want to delete all saved CFT calculations for this branch? This action cannot be undone.',
      async () => {
        try {
          await clearCftCalculations();
          setSelectedLogIds([]);
          showToast('success', 'All calculation histories cleared.');
        } catch (err) {
          console.error(err);
          showToast('error', 'Failed to clear histories.');
        }
      }
    );
  };

  // Combined sum calculations
  const selectedLogs = cftCalculations.filter(c => selectedLogIds.includes(c.id!));
  const combinedCftSum = selectedLogs.reduce((sum, c) => sum + c.totalCft, 0);

  return (
    <div className="flex flex-col gap-6 animate-fade-in relative pb-16">
      
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 p-4 rounded-xl border text-xs font-semibold shadow-lg animate-scale-up ${
          toast.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-808 dark:text-emerald-450' 
            : 'bg-red-500/10 border-red-500/20 text-red-808 dark:text-red-400'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Main Split Layout: Calculator Form on left, History list on right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side: Calculator Panel (5 columns) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="glass-card rounded-2xl p-6 border border-stone-200/35 dark:border-stone-800/30 flex flex-col gap-5 shadow-sm">
            <div className="flex items-center gap-2 pb-2 border-b border-stone-200/30 dark:border-stone-800/20">
              <Calculator className="text-accent" size={16} />
              <h3 className="text-xs font-bold text-stone-850 dark:text-stone-100 uppercase tracking-wide">
                Volume CFT Calculator
              </h3>
            </div>

            <form onSubmit={handleSaveCalculation} className="flex flex-col gap-4">
              
              {/* Item Label */}
              <div className="flex flex-col gap-1.5">
                <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                  Item Description / Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Pine Beams, Door planks, Teak Wood..."
                  value={label}
                  onChange={e => setLabel(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-transparent text-xs text-stone-800 dark:text-stone-200 focus:outline-none focus:border-accent"
                />
              </div>

              {/* Thickness Row */}
              <div className="grid grid-cols-3 gap-3 items-end">
                <div className="col-span-2 flex flex-col gap-1.5">
                  <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                    Thickness / Height
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    placeholder="4"
                    value={thickness}
                    onChange={e => setThickness(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-transparent text-xs font-bold text-stone-850 dark:text-stone-200 focus:outline-none focus:border-accent"
                    required
                  />
                </div>
                <select
                  value={thicknessUnit}
                  onChange={e => setThicknessUnit(e.target.value as any)}
                  className="px-2 py-2 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-stone-50 dark:bg-darkCard text-xs text-stone-850 dark:text-stone-200 focus:outline-none cursor-pointer"
                >
                  <option value="inches">Inches (in)</option>
                  <option value="feet">Feet (ft)</option>
                  <option value="cm">Cm</option>
                </select>
              </div>

              {/* Width Row */}
              <div className="grid grid-cols-3 gap-3 items-end">
                <div className="col-span-2 flex flex-col gap-1.5">
                  <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                    Width / Breadth
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    placeholder="2"
                    value={width}
                    onChange={e => setWidth(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-transparent text-xs font-bold text-stone-850 dark:text-stone-200 focus:outline-none focus:border-accent"
                    required
                  />
                </div>
                <select
                  value={widthUnit}
                  onChange={e => setWidthUnit(e.target.value as any)}
                  className="px-2 py-2 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-stone-50 dark:bg-darkCard text-xs text-stone-850 dark:text-stone-200 focus:outline-none cursor-pointer"
                >
                  <option value="inches">Inches (in)</option>
                  <option value="feet">Feet (ft)</option>
                  <option value="cm">Cm</option>
                </select>
              </div>

              {/* Length Row */}
              <div className="grid grid-cols-3 gap-3 items-end">
                <div className="col-span-2 flex flex-col gap-1.5">
                  <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                    Length
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    placeholder="5"
                    value={length}
                    onChange={e => setLength(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-transparent text-xs font-bold text-stone-850 dark:text-stone-200 focus:outline-none focus:border-accent"
                    required
                  />
                </div>
                <select
                  value={lengthUnit}
                  onChange={e => setLengthUnit(e.target.value as any)}
                  className="px-2 py-2 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-stone-50 dark:bg-darkCard text-xs text-stone-850 dark:text-stone-200 focus:outline-none cursor-pointer"
                >
                  <option value="feet">Feet (ft)</option>
                  <option value="inches">Inches (in)</option>
                  <option value="cm">Cm</option>
                </select>
              </div>

              {/* Quantity Field */}
              <div className="flex flex-col gap-1.5">
                <label className="text-3xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                  Quantity / Pieces Count
                </label>
                <input
                  type="number"
                  placeholder="1"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-250/50 dark:border-stone-800/70 bg-transparent text-xs font-bold text-stone-850 dark:text-stone-200 focus:outline-none focus:border-accent"
                  required
                />
              </div>

              {/* Real-time Result Output */}
              <div className="bg-primary/5 dark:bg-accent/5 border border-primary/10 dark:border-accent/10 rounded-2xl p-4.5 flex flex-col gap-1.5 mt-2">
                <div className="flex justify-between items-center text-3xs font-semibold text-stone-500 dark:text-stone-400">
                  <span>Unit Conversion</span>
                  <span>
                    {tVal} {thicknessUnit.slice(0, 2)} x {wVal} {widthUnit.slice(0, 2)} x {lVal} {lengthUnit.slice(0, 2)}
                  </span>
                </div>
                <div className="flex justify-between items-end border-t border-stone-200/10 pt-2 flex-wrap">
                  <div className="flex flex-col">
                    <span className="text-4xs text-stone-450 dark:text-stone-500 uppercase tracking-wide font-semibold">
                      Cubic Volume Output
                    </span>
                    <span className="text-lg font-black text-primary dark:text-accent">
                      {calculatedTotalCft.toFixed(3)} <span className="text-2xs font-extrabold">CFT</span>
                    </span>
                  </div>
                  
                  {qVal > 1 && (
                    <span className="text-3xs text-stone-500 dark:text-stone-400 font-semibold mb-1">
                      ({calculatedCftPerPiece.toFixed(3)} CFT/pc x {qVal})
                    </span>
                  )}
                </div>
              </div>

              {/* Save Calculation Button */}
              <button
                type="submit"
                className="flex items-center justify-center gap-1.5 w-full py-2.5 bg-accent hover:bg-accent-hover text-white text-xs font-bold rounded-xl shadow-sm transition-all"
              >
                <Plus size={14} />
                Save
              </button>

            </form>
          </div>
        </div>

        {/* Right Side: Calculation Logs & Combine Panel (7 columns) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="glass-card rounded-2xl p-6 border border-stone-200/35 dark:border-stone-800/30 flex flex-col gap-4 shadow-sm h-full">
            
            {/* Logs Header */}
            <div className="flex justify-between items-center pb-2 border-b border-stone-200/30 dark:border-stone-800/20">
              <span className="text-xs font-bold text-stone-850 dark:text-stone-100 flex items-center gap-1.5">
                <Layers size={14} className="text-accent" />
                Calculation Logs History ({cftCalculations.length})
              </span>
              
              {cftCalculations.length > 0 && (
                <button
                  onClick={handleClearAllHistory}
                  className="text-4xs font-bold text-red-500 hover:underline flex items-center gap-0.5"
                >
                  <Trash2 size={10} />
                  Clear History
                </button>
              )}
            </div>

            {/* Check all / Clear selection actions */}
            {cftCalculations.length > 0 && (
              <div className="flex gap-2">
                <button 
                  onClick={handleSelectAll}
                  className="py-1 px-2 border border-stone-250 dark:border-stone-800 rounded-lg text-4xs font-bold hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300 transition-colors"
                >
                  Check All
                </button>
                <button 
                  onClick={handleClearSelection}
                  className="py-1 px-2 border border-stone-250 dark:border-stone-800 rounded-lg text-4xs font-bold hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300 transition-colors"
                >
                  Uncheck All
                </button>
              </div>
            )}

            {/* Calculations List */}
            {cftCalculations.length === 0 ? (
              <div className="py-20 text-center flex flex-col items-center justify-center gap-2 border border-dashed border-stone-200 dark:border-stone-800/40 rounded-xl">
                <Clipboard className="text-stone-400" size={24} />
                <span className="text-xs font-semibold text-stone-850 dark:text-stone-200">History is Empty</span>
                <span className="text-4xs text-stone-450 dark:text-stone-500 max-w-xs leading-relaxed">
                  Log your timber measurement calculations on the left to review, delete, or combine multiple logs for totals.
                </span>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto max-h-[400px] flex flex-col gap-2.5 pr-1 no-scrollbar">
                {cftCalculations.map(calc => {
                  const isChecked = selectedLogIds.includes(calc.id!);
                  return (
                    <div
                      key={calc.id}
                      onClick={() => handleToggleLog(calc.id!)}
                      className={`p-3.5 rounded-xl border flex items-center justify-between gap-4 cursor-pointer transition-all ${
                        isChecked 
                          ? 'bg-primary/5 dark:bg-accent/5 border-primary/20 dark:border-accent/20' 
                          : 'bg-white dark:bg-darkCard/40 border-stone-200/50 dark:border-stone-800/45 hover:border-accent/40'
                      }`}
                    >
                      {/* Left: Checkbox + Calculation Info */}
                      <div className="flex items-center gap-3 min-w-0">
                        {isChecked ? (
                          <CheckSquare size={16} className="text-accent shrink-0" />
                        ) : (
                          <Square size={16} className="text-stone-450 dark:text-stone-500 shrink-0" />
                        )}
                        
                        <div className="flex flex-col gap-1 min-w-0">
                          <span className="text-2xs font-bold text-stone-800 dark:text-stone-200 truncate">
                            {calc.label}
                          </span>
                          <span className="text-4xs text-stone-450 dark:text-stone-500 font-semibold">
                            Size: {calc.thickness}{calc.thicknessUnit.slice(0, 2)} x {calc.width}{calc.widthUnit.slice(0, 2)} x {calc.length}{calc.lengthUnit.slice(0, 2)} 
                            {calc.quantity > 1 && ` (Qty: ${calc.quantity})`}
                          </span>
                        </div>
                      </div>

                      {/* Right: Calculated Value + Delete */}
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="flex flex-col items-end">
                          <span className="text-xs font-black text-stone-850 dark:text-stone-150">
                            {calc.totalCft.toFixed(3)} <span className="text-4xs font-bold">CFT</span>
                          </span>
                          {calc.quantity > 1 && (
                            <span className="text-4xs text-stone-400 font-medium">
                              {calc.cftPerPiece.toFixed(3)} CFT/pc
                            </span>
                          )}
                        </div>

                        <button
                          onClick={(e) => handleDeleteLog(calc.id!, e)}
                          className="p-1.5 text-stone-400 hover:text-red-500 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                          title="Delete Calculation"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}

            {/* Bottom Combined Totals Banner (Renders if logs exist) */}
            {cftCalculations.length > 0 && (
              <div className="bg-primary/5 dark:bg-accent/5 border-2 border-dashed border-primary/20 dark:border-accent/20 rounded-2xl p-4.5 flex flex-col gap-1.5 mt-auto">
                <div className="flex justify-between items-center text-3xs font-semibold text-stone-500 dark:text-stone-400">
                  <span className="flex items-center gap-1.5">
                    <Ruler size={12} className="text-accent" />
                    Combined Volume Summary
                  </span>
                  <span>{selectedLogIds.length} of {cftCalculations.length} checked</span>
                </div>
                
                <div className="flex justify-between items-end border-t border-stone-200/10 pt-2">
                  <div className="flex flex-col">
                    <span className="text-4xs text-stone-450 dark:text-stone-500 uppercase tracking-wide font-semibold">
                      Total Checked Cubic Feet (CFT)
                    </span>
                    <span className="text-base font-black text-accent mt-0.5">
                      {combinedCftSum.toFixed(3)} <span className="text-2xs font-extrabold">CFT</span>
                    </span>
                  </div>
                  
                  {selectedLogIds.length === 0 && (
                    <span className="text-4xs text-stone-400 dark:text-stone-500 italic mb-0.5">
                      Check log items to sum volumes
                    </span>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>

      </div>

      {/* Confirmation Modal */}
      {confirmModal && confirmModal.isOpen && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-3xs animate-fade-in">
          <div className="glass-card rounded-2xl max-w-sm w-full p-6 shadow-xl flex flex-col gap-4 border border-stone-200/60 dark:border-stone-850/60 animate-scale-up">
            <h4 className="text-base font-bold text-primary dark:text-accent flex items-center gap-2">
              <AlertTriangle className="text-amber-500" size={18} />
              {confirmModal.title}
            </h4>
            <p className="text-2xs text-stone-550 dark:text-stone-400 leading-relaxed">
              {confirmModal.message}
            </p>
            <div className="flex items-center gap-3 justify-end mt-2">
              <button
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 border border-stone-250/50 dark:border-stone-805/60 rounded-xl text-xs font-semibold text-stone-650 dark:text-stone-300 hover:bg-stone-105 dark:hover:bg-stone-800 transition-all"
              >
                No, Cancel
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-accent hover:bg-accent-hover text-white shadow-sm transition-all"
              >
                Yes, Proceed
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
