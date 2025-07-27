import { useState } from "react";

const BulgariaMap = () => {
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);

  const provinces = [
    { name: "София", count: 45 },
    { name: "Пловдив", count: 12 },
    { name: "Варна", count: 8 },
    { name: "Бургас", count: 6 },
    { name: "Русе", count: 4 },
    { name: "Стара Загора", count: 3 },
  ];

  return (
    <div className="bg-secondary/50 rounded-lg p-8">
      <h3 className="text-2xl font-bold text-center mb-6">Изберете регион</h3>
      
      {/* Simplified SVG Map Placeholder */}
      <div className="relative bg-background rounded-lg p-8 mb-6">
        <svg
          viewBox="0 0 400 200"
          className="w-full h-64 mx-auto"
        >
          {/* Simplified Bulgaria outline */}
          <path
            d="M50 100 Q100 50 150 80 Q200 60 250 70 Q300 65 350 80 Q380 100 370 130 Q350 160 300 150 Q250 170 200 160 Q150 150 100 140 Q70 120 50 100 Z"
            fill="hsl(var(--placero-light-gray))"
            stroke="hsl(var(--border))"
            strokeWidth="2"
            className="hover:fill-primary/10 cursor-pointer transition-colors"
            onClick={() => setSelectedProvince("България")}
          />
          
          {/* Province dots */}
          {provinces.map((province, index) => (
            <circle
              key={province.name}
              cx={80 + index * 45}
              cy={90 + Math.sin(index) * 20}
              r="6"
              fill="hsl(var(--primary))"
              className="hover:fill-primary/80 cursor-pointer transition-colors"
              onClick={() => setSelectedProvince(province.name)}
            />
          ))}
        </svg>
      </div>

      {/* Province List */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {provinces.map((province) => (
          <div
            key={province.name}
            onClick={() => setSelectedProvince(province.name)}
            className={`p-4 rounded-lg border cursor-pointer transition-colors ${
              selectedProvince === province.name
                ? "bg-primary text-primary-foreground"
                : "bg-background hover:bg-secondary"
            }`}
          >
            <div className="text-center">
              <h4 className="font-semibold">{province.name}</h4>
              <p className="text-sm opacity-80">{province.count} офиса</p>
            </div>
          </div>
        ))}
      </div>

      {selectedProvince && (
        <div className="mt-4 p-4 bg-primary/10 rounded-lg">
          <p className="text-center text-sm">
            Избрахте: <span className="font-semibold">{selectedProvince}</span>
          </p>
        </div>
      )}
    </div>
  );
};

export default BulgariaMap;