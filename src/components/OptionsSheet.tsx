import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MenuItem } from "../types";
import { X, Check } from "lucide-react";

interface OptionsSheetProps {
  item: MenuItem | null;
  onClose: () => void;
  onConfirm: (quantity: number, selectedOptions: Record<string, string>) => void;
}

export default function OptionsSheet({ item, onClose, onConfirm }: OptionsSheetProps) {
  const [quantity, setQuantity] = useState(1);
  const [options, setOptions] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!item) return;
    setQuantity(1);

    // Seed default selection based on standard values
    if (item.name === "Bakso") {
      setOptions({ pedas: "Sedang" });
    } else if (item.name === "Spanish Latte") {
      setOptions({ gula: "Normal", suhu: "Dingin" });
    } else if (item.name === "Teh Poci") {
      setOptions({ gula: "Normal" });
    } else {
      setOptions({});
    }
  }, [item]);

  if (!item) return null;

  const handleConfirm = () => {
    onConfirm(quantity, options);
    onClose();
  };

  const getEmojiFallback = (name: string) => {
    if (name.includes("Bakso")) return "🍜";
    if (name.includes("Latte")) return "🥤";
    if (name.includes("Teh")) return "☕";
    return "🍽️";
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 overflow-hidden md:items-center">
        {/* Backdrop filter trigger */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-transparent cursor-pointer"
        />

        {/* Modal Sheet body */}
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative w-full max-w-md bg-[#FFF0F2] rounded-t-3xl shadow-2xl p-6 text-gray-800 z-10 flex flex-col max-h-[90vh] overflow-y-auto md:rounded-3xl"
        >
          {/* Header */}
          <div className="flex justify-between items-start mb-4">
            <div>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#DF3E58]/10 text-[#DF3E58]">
                {item.category}
              </span>
              <h3 className="text-xl font-bold mt-1 text-[#DF3E58]">{item.name}</h3>
              <p className="text-sm font-semibold text-[#DF3E58] mt-0.5">
                Rp {item.price.toLocaleString("id-ID")}
              </p>
            </div>
            <button
              onClick={onClose}
              id="close-options-sheet"
              className="p-1 rounded-full bg-gray-200 hover:bg-gray-300 transition duration-150"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          <p className="text-xs text-gray-500 mb-6">{item.description}</p>

          {/* Emojis fallback custom graphic illustration banner */}
          <div className="flex justify-center py-4 bg-rose-50/50 rounded-2xl mb-6">
            <span className="text-6xl animate-bounce duration-1000">{getEmojiFallback(item.name)}</span>
          </div>

          {/* Custom option groups */}
          <div className="space-y-6 flex-1">
            {/* 1. Bakso: Tingkat Pedas */}
            {item.name === "Bakso" && (
               <div>
                <label className="block text-sm font-bold text-gray-705 mb-2">Tingkat Pedas</label>
                <div className="grid grid-cols-2 gap-2">
                  {["Tidak Pedas", "Sedang", "Pedas", "Extra Pedas"].map((level) => (
                    <button
                      key={level}
                      onClick={() => setOptions({ ...options, pedas: level })}
                      className={`flex justify-between items-center px-4 py-2.5 rounded-xl text-sm font-semibold transition ${
                        options.pedas === level
                          ? "border-2 border-[#DF3E58] bg-rose-50 text-[#DF3E58] font-bold"
                          : "border border-gray-200 bg-white text-gray-600 hover:border-[#DF3E58]/30"
                      }`}
                    >
                      <span>{level}</span>
                      {options.pedas === level && <Check className="w-4 h-4 text-[#DF3E58] stroke-[2.5]" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 2. Spanish Latte: Tingkat Gula, Suhu */}
            {item.name === "Spanish Latte" && (
              <>
                <div>
                  <label className="block text-sm font-bold text-gray-705 mb-2">Tingkat Gula</label>
                  <div className="grid grid-cols-3 gap-2">
                    {["Less Sweet", "Normal", "Extra Sweet"].map((sugar) => (
                      <button
                        key={sugar}
                        onClick={() => setOptions({ ...options, gula: sugar })}
                        className={`flex flex-col justify-center items-center py-2.5 px-1 rounded-xl text-xs font-semibold transition ${
                          options.gula === sugar
                            ? "border-2 border-[#DF3E58] bg-rose-50 text-[#DF3E58] font-bold"
                            : "border border-gray-200 bg-white text-gray-600 hover:border-[#DF3E58]/30"
                        }`}
                      >
                        <span className="text-center">{sugar}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-705 mb-2">Suhu</label>
                  <div className="grid grid-cols-2 gap-2">
                    {["Panas", "Dingin"].map((temp) => (
                      <button
                        key={temp}
                        onClick={() => setOptions({ ...options, suhu: temp })}
                        className={`flex justify-between items-center px-4 py-2.5 rounded-xl text-sm font-semibold transition ${
                          options.suhu === temp
                            ? "border-2 border-[#DF3E58] bg-rose-50 text-[#DF3E58] font-bold"
                            : "border border-gray-200 bg-white text-gray-600 hover:border-[#DF3E58]/30"
                        }`}
                      >
                        <span>{temp} {temp === "Panas" ? "🔥" : "🧊"}</span>
                        {options.suhu === temp && <Check className="w-4 h-4 text-[#DF3E58] stroke-[2.5]" />}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* 3. Teh Poci: Tingkat Gula */}
            {item.name === "Teh Poci" && (
              <div>
                <label className="block text-sm font-bold text-gray-705 mb-2">Tingkat Gula</label>
                <div className="grid grid-cols-2 gap-2">
                  {["Tawar", "Sedikit", "Normal", "Manis"].map((sugarLevel) => (
                    <button
                      key={sugarLevel}
                      onClick={() => setOptions({ ...options, gula: sugarLevel })}
                      className={`flex justify-between items-center px-4 py-2.5 rounded-xl text-sm font-semibold transition ${
                        options.gula === sugarLevel
                          ? "border-2 border-[#DF3E58] bg-rose-50 text-[#DF3E58] font-bold"
                          : "border border-gray-200 bg-white text-gray-600 hover:border-[#DF3E58]/30"
                      }`}
                    >
                      <span>{sugarLevel}</span>
                      {options.gula === sugarLevel && <Check className="w-4 h-4 text-[#DF3E58] stroke-[2.5]" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quantity adjustments */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Kuantitas</label>
              <div className="flex items-center justify-between bg-white rounded-xl p-3 border border-gray-200">
                <span className="text-sm text-gray-500 font-medium">Jumlah Porsi</span>
                <div className="flex items-center space-x-4">
                  <button
                    disabled={quantity <= 1}
                    onClick={() => setQuantity(quantity - 1)}
                    className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-700 font-bold transition disabled:opacity-45"
                  >
                    -
                  </button>
                  <span className="font-bold text-lg text-gray-800">{quantity}</span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-700 font-bold transition"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex h-6" />

          {/* Confirm Button */}
          <button
            onClick={handleConfirm}
            id="confirm-add-to-cart"
            className="w-full py-4 rounded-xl bg-[#DF3E58] hover:bg-[#FF758F] active:scale-[0.98] transition duration-200 flex items-center justify-center space-x-2 text-white font-bold"
          >
            <span>Tambah ke Keranjang • Rp {(item.price * quantity).toLocaleString("id-ID")}</span>
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
