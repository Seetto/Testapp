'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface Ball {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
}

interface BouncingBallsProps {
  ballCount?: number;
  className?: string;
}

const BouncingBalls: React.FC<BouncingBallsProps> = ({ 
  ballCount = 8, 
  className = '' 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const ballsRef = useRef<Ball[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Set mounted state and check for dark mode
  useEffect(() => {
    setIsMounted(true);
    
    const checkDarkMode = () => {
      setIsDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches);
    };
    
    checkDarkMode();
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', checkDarkMode);
    
    return () => mediaQuery.removeEventListener('change', checkDarkMode);
  }, []);

  // Initialize balls
  const initializeBalls = useCallback((canvas: HTMLCanvasElement) => {
    const balls: Ball[] = [];
    const colors = isDarkMode 
      ? ['#ffffff20', '#ededed15', '#ffffff10', '#ededed25', '#ffffff18']
      : ['#17171720', '#00000015', '#17171710', '#00000025', '#17171718'];

    for (let i = 0; i < ballCount; i++) {
      const radius = Math.random() * 20 + 10; // 10-30px radius
      const x = Math.random() * (canvas.width - radius * 2) + radius;
      const y = Math.random() * (canvas.height - radius * 2) + radius;
      const vx = (Math.random() - 0.5) * 2; // -1 to 1
      const vy = (Math.random() - 0.5) * 2; // -1 to 1
      const color = colors[Math.floor(Math.random() * colors.length)];

      balls.push({ id: i, x, y, vx, vy, radius, color });
    }

    ballsRef.current = balls;
  }, [ballCount, isDarkMode]);

  // Check collision between two balls
  const checkCollision = (ball1: Ball, ball2: Ball): boolean => {
    const dx = ball1.x - ball2.x;
    const dy = ball1.y - ball2.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < ball1.radius + ball2.radius;
  };

  // Handle collision between two balls
  const handleCollision = (ball1: Ball, ball2: Ball) => {
    const dx = ball1.x - ball2.x;
    const dy = ball1.y - ball2.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Normalize collision vector
    const nx = dx / distance;
    const ny = dy / distance;

    // Relative velocity
    const dvx = ball1.vx - ball2.vx;
    const dvy = ball1.vy - ball2.vy;

    // Relative velocity in collision normal direction
    const dvn = dvx * nx + dvy * ny;

    // Don't resolve if velocities are separating
    if (dvn > 0) return;

    // Collision impulse
    const impulse = 2 * dvn / 2; // Assuming equal mass

    // Update velocities
    ball1.vx -= impulse * nx;
    ball1.vy -= impulse * ny;
    ball2.vx += impulse * nx;
    ball2.vy += impulse * ny;

    // Separate balls to prevent overlap
    const overlap = ball1.radius + ball2.radius - distance;
    const separationX = nx * overlap * 0.5;
    const separationY = ny * overlap * 0.5;

    ball1.x += separationX;
    ball1.y += separationY;
    ball2.x -= separationX;
    ball2.y -= separationY;
  };

  // Update ball positions and handle collisions
  const updateBalls = useCallback((canvas: HTMLCanvasElement) => {
    const balls = ballsRef.current;

    // Update positions
    balls.forEach(ball => {
      ball.x += ball.vx;
      ball.y += ball.vy;

      // Bounce off walls
      if (ball.x - ball.radius <= 0 || ball.x + ball.radius >= canvas.width) {
        ball.vx *= -0.98; // Add slight damping
        ball.x = ball.x - ball.radius <= 0 
          ? ball.radius 
          : canvas.width - ball.radius;
      }
      if (ball.y - ball.radius <= 0 || ball.y + ball.radius >= canvas.height) {
        ball.vy *= -0.98; // Add slight damping
        ball.y = ball.y - ball.radius <= 0 
          ? ball.radius 
          : canvas.height - ball.radius;
      }
    });

    // Check for ball-to-ball collisions
    for (let i = 0; i < balls.length; i++) {
      for (let j = i + 1; j < balls.length; j++) {
        if (checkCollision(balls[i], balls[j])) {
          handleCollision(balls[i], balls[j]);
        }
      }
    }
  }, []);

  // Draw balls on canvas
  const drawBalls = useCallback((canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ballsRef.current.forEach(ball => {
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      
      // Create gradient for modern look
      const gradient = ctx.createRadialGradient(
        ball.x - ball.radius * 0.3, 
        ball.y - ball.radius * 0.3, 
        0,
        ball.x, 
        ball.y, 
        ball.radius
      );
      
      if (isDarkMode) {
        gradient.addColorStop(0, '#ffffff40');
        gradient.addColorStop(0.7, ball.color);
        gradient.addColorStop(1, '#ffffff05');
      } else {
        gradient.addColorStop(0, '#ffffff60');
        gradient.addColorStop(0.7, ball.color);
        gradient.addColorStop(1, '#00000008');
      }
      
      ctx.fillStyle = gradient;
      ctx.fill();
      
      // Add subtle border
      ctx.strokeStyle = isDarkMode ? '#ffffff10' : '#00000010';
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  }, [isDarkMode]);

  // Animation loop
  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    updateBalls(canvas);
    drawBalls(canvas, ctx);

    animationRef.current = requestAnimationFrame(animate);
  }, [updateBalls, drawBalls]);

  // Handle canvas resize
  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Use full viewport dimensions
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Reinitialize balls with new dimensions
    initializeBalls(canvas);
  }, [initializeBalls]);

  useEffect(() => {
    if (!isMounted) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas size to full viewport
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    initializeBalls(canvas);
    animate();

    // Handle window resize
    window.addEventListener('resize', handleResize);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      window.removeEventListener('resize', handleResize);
    };
  }, [isMounted, initializeBalls, animate, handleResize]);

  // Don't render until mounted to prevent hydration mismatch
  if (!isMounted) {
    return null;
  }

  return (
    <canvas
      ref={canvasRef}
      className={`fixed inset-0 w-full h-full pointer-events-none ${className}`}
      style={{ zIndex: -1 }}
    />
  );
};

export default BouncingBalls;
