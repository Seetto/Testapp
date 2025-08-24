'use client';

import { useEffect, useState } from 'react';

interface BokehCircle {
  id: number;
  x: number;
  y: number;
  radius: number;
  opacity: number;
  color: string;
}

interface BokehBackgroundProps {
  className?: string;
}

const BokehBackground: React.FC<BokehBackgroundProps> = ({ className = '' }) => {
  const [circles, setCircles] = useState<BokehCircle[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;

    const generateCircles = () => {
      const newCircles: BokehCircle[] = [];
      const circleCount = 30; // More circles for better coverage
      
      // Bokeh colors - warm orange/yellow tones inspired by the reference image
      const colors = [
        '#FF8C00',  // Dark orange
        '#FFA500',  // Orange  
        '#FFD700',  // Gold
        '#FF6347',  // Tomato
        '#FF7F50',  // Coral
        '#FFA07A',  // Light salmon
        '#FFEAA7',  // Banana yellow
        '#FDCB6E',  // Orange yellow
        '#E17055',  // Terra cotta
        '#FFAB00',  // Amber
      ];

      for (let i = 0; i < circleCount; i++) {
        const radius = Math.random() * 150 + 30; // 30-180px radius for variety
        const x = Math.random() * 120 - 10; // -10% to 110% to allow overflow
        const y = Math.random() * 120 - 10; // -10% to 110% to allow overflow
        const opacity = Math.random() * 0.4 + 0.1; // 0.1-0.5 opacity
        const color = colors[Math.floor(Math.random() * colors.length)];

        newCircles.push({
          id: i,
          x,
          y,
          radius,
          opacity,
          color,
        });
      }

      setCircles(newCircles);
    };

    generateCircles();
  }, [isMounted]);

  if (!isMounted) {
    return null;
  }

  return (
    <div
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      style={{ 
        zIndex: 0,
        background: 'linear-gradient(135deg, #2c1810 0%, #1a0f08 50%, #0d0502 100%)'
      }}
    >
      {/* Bokeh circles */}
      {circles.map((circle) => (
        <div
          key={circle.id}
          className="absolute rounded-full"
          style={{
            left: `${circle.x}%`,
            top: `${circle.y}%`,
            width: `${circle.radius}px`,
            height: `${circle.radius}px`,
            background: `radial-gradient(circle at 30% 30%, 
              ${circle.color}${Math.round(circle.opacity * 255).toString(16).padStart(2, '0')}, 
              ${circle.color}${Math.round(circle.opacity * 0.7 * 255).toString(16).padStart(2, '0')} 60%, 
              transparent 80%)`,
            transform: 'translate(-50%, -50%)',
            filter: 'blur(1px)',
            animation: `bokehFloat ${8 + Math.random() * 4}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 2}s`,
          }}
        />
      ))}
      
      {/* Global CSS for animation */}
      <style jsx global>{`
        @keyframes bokehFloat {
          0%, 100% {
            transform: translate(-50%, -50%) translateY(0px) scale(1);
            opacity: 0.8;
          }
          25% {
            transform: translate(-50%, -50%) translateY(-10px) scale(1.05);
            opacity: 1;
          }
          50% {
            transform: translate(-50%, -50%) translateY(-20px) scale(0.95);
            opacity: 0.9;
          }
          75% {
            transform: translate(-50%, -50%) translateY(-10px) scale(1.02);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default BokehBackground;
