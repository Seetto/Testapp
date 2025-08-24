'use client';

import { useEffect, useRef, useState } from 'react';

interface BokehCircle {
  id: number;
  x: number;
  y: number;
  radius: number;
  opacity: number;
  color: string;
  animationSpeed: number;
  animationOffset: number;
}

interface BokehBackgroundProps {
  className?: string;
}

const BokehBackground: React.FC<BokehBackgroundProps> = ({ className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [circles, setCircles] = useState<BokehCircle[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;

    const generateCircles = () => {
      const newCircles: BokehCircle[] = [];
      const circleCount = 25; // More circles for better coverage
      
      // Bokeh colors - warm orange/yellow tones, more dulled
      const colors = [
        'rgba(255, 140, 0, 0.15)',    // Dark orange
        'rgba(255, 165, 0, 0.12)',    // Orange  
        'rgba(255, 200, 0, 0.18)',    // Golden yellow
        'rgba(255, 215, 0, 0.10)',    // Gold
        'rgba(255, 69, 0, 0.08)',     // Red-orange
        'rgba(255, 160, 122, 0.14)',  // Light salmon
        'rgba(255, 218, 185, 0.16)',  // Peach
      ];

      for (let i = 0; i < circleCount; i++) {
        const radius = Math.random() * 120 + 40; // 40-160px radius for variety
        const x = Math.random() * 100; // Percentage
        const y = Math.random() * 100; // Percentage
        const opacity = Math.random() * 0.3 + 0.1; // 0.1-0.4 opacity
        const color = colors[Math.floor(Math.random() * colors.length)];
        const animationSpeed = Math.random() * 0.5 + 0.2; // 0.2-0.7 speed multiplier
        const animationOffset = Math.random() * Math.PI * 2; // Random phase offset

        newCircles.push({
          id: i,
          x,
          y,
          radius,
          opacity,
          color,
          animationSpeed,
          animationOffset,
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
      ref={containerRef}
      className={`fixed inset-0 overflow-hidden pointer-events-none ${className}`}
      style={{ zIndex: -1 }}
    >
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-orange-50/30 via-yellow-50/20 to-orange-100/25" />
      
      {/* Bokeh circles */}
      {circles.map((circle) => (
        <div
          key={circle.id}
          className="absolute rounded-full blur-sm animate-pulse"
          style={{
            left: `${circle.x}%`,
            top: `${circle.y}%`,
            width: `${circle.radius}px`,
            height: `${circle.radius}px`,
            backgroundColor: circle.color,
            opacity: circle.opacity,
            transform: 'translate(-50%, -50%)',
            animation: `bokeh-float-${circle.id} ${8 / circle.animationSpeed}s ease-in-out infinite`,
            animationDelay: `${circle.animationOffset}s`,
          }}
        />
      ))}
      
      {/* CSS for floating animation */}
      <style jsx>{`
        @keyframes bokeh-float-1 { 0%, 100% { transform: translate(-50%, -50%) translateY(0px); } 50% { transform: translate(-50%, -50%) translateY(-20px); } }
        @keyframes bokeh-float-2 { 0%, 100% { transform: translate(-50%, -50%) translateY(0px); } 50% { transform: translate(-50%, -50%) translateY(-15px); } }
        @keyframes bokeh-float-3 { 0%, 100% { transform: translate(-50%, -50%) translateY(0px); } 50% { transform: translate(-50%, -50%) translateY(-25px); } }
        @keyframes bokeh-float-4 { 0%, 100% { transform: translate(-50%, -50%) translateY(0px); } 50% { transform: translate(-50%, -50%) translateY(-18px); } }
        @keyframes bokeh-float-5 { 0%, 100% { transform: translate(-50%, -50%) translateY(0px); } 50% { transform: translate(-50%, -50%) translateY(-22px); } }
        @keyframes bokeh-float-6 { 0%, 100% { transform: translate(-50%, -50%) translateY(0px); } 50% { transform: translate(-50%, -50%) translateY(-12px); } }
        @keyframes bokeh-float-7 { 0%, 100% { transform: translate(-50%, -50%) translateY(0px); } 50% { transform: translate(-50%, -50%) translateY(-28px); } }
        @keyframes bokeh-float-8 { 0%, 100% { transform: translate(-50%, -50%) translateY(0px); } 50% { transform: translate(-50%, -50%) translateY(-16px); } }
        @keyframes bokeh-float-9 { 0%, 100% { transform: translate(-50%, -50%) translateY(0px); } 50% { transform: translate(-50%, -50%) translateY(-24px); } }
        @keyframes bokeh-float-10 { 0%, 100% { transform: translate(-50%, -50%) translateY(0px); } 50% { transform: translate(-50%, -50%) translateY(-14px); } }
        @keyframes bokeh-float-11 { 0%, 100% { transform: translate(-50%, -50%) translateY(0px); } 50% { transform: translate(-50%, -50%) translateY(-26px); } }
        @keyframes bokeh-float-12 { 0%, 100% { transform: translate(-50%, -50%) translateY(0px); } 50% { transform: translate(-50%, -50%) translateY(-19px); } }
        @keyframes bokeh-float-13 { 0%, 100% { transform: translate(-50%, -50%) translateY(0px); } 50% { transform: translate(-50%, -50%) translateY(-21px); } }
        @keyframes bokeh-float-14 { 0%, 100% { transform: translate(-50%, -50%) translateY(0px); } 50% { transform: translate(-50%, -50%) translateY(-17px); } }
        @keyframes bokeh-float-15 { 0%, 100% { transform: translate(-50%, -50%) translateY(0px); } 50% { transform: translate(-50%, -50%) translateY(-23px); } }
        @keyframes bokeh-float-16 { 0%, 100% { transform: translate(-50%, -50%) translateY(0px); } 50% { transform: translate(-50%, -50%) translateY(-13px); } }
        @keyframes bokeh-float-17 { 0%, 100% { transform: translate(-50%, -50%) translateY(0px); } 50% { transform: translate(-50%, -50%) translateY(-27px); } }
        @keyframes bokeh-float-18 { 0%, 100% { transform: translate(-50%, -50%) translateY(0px); } 50% { transform: translate(-50%, -50%) translateY(-15px); } }
        @keyframes bokeh-float-19 { 0%, 100% { transform: translate(-50%, -50%) translateY(0px); } 50% { transform: translate(-50%, -50%) translateY(-20px); } }
        @keyframes bokeh-float-20 { 0%, 100% { transform: translate(-50%, -50%) translateY(0px); } 50% { transform: translate(-50%, -50%) translateY(-18px); } }
        @keyframes bokeh-float-21 { 0%, 100% { transform: translate(-50%, -50%) translateY(0px); } 50% { transform: translate(-50%, -50%) translateY(-25px); } }
        @keyframes bokeh-float-22 { 0%, 100% { transform: translate(-50%, -50%) translateY(0px); } 50% { transform: translate(-50%, -50%) translateY(-16px); } }
        @keyframes bokeh-float-23 { 0%, 100% { transform: translate(-50%, -50%) translateY(0px); } 50% { transform: translate(-50%, -50%) translateY(-22px); } }
        @keyframes bokeh-float-24 { 0%, 100% { transform: translate(-50%, -50%) translateY(0px); } 50% { transform: translate(-50%, -50%) translateY(-14px); } }
      `}</style>
    </div>
  );
};

export default BokehBackground;
