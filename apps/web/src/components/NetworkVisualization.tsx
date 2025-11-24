import { useEffect, useRef, useState } from 'react';
import { Activity, Zap, Globe } from 'lucide-react';

interface Validator {
  id: string;
  name: string;
  region: string;
  enabled: boolean;
  online: boolean;
  created_at: string;
  last_seen_at: string | null;
}

interface NetworkVisualizationProps {
  validators: Validator[];
  onlineCount: number;
  health: string | null;
}

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  validator: Validator;
  angle: number;
  radius: number;
  isDragging?: boolean;
  targetX?: number;
  targetY?: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color?: string;
}

interface ScanWave {
  radius: number;
  alpha: number;
  speed: number;
}

export default function NetworkVisualization({ validators, onlineCount, health }: NetworkVisualizationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredNode, setHoveredNode] = useState<Validator | null>(null);
  const nodesRef = useRef<Node[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const scanWavesRef = useRef<ScanWave[]>([]);
  const animationRef = useRef<number>();
  const draggedNodeRef = useRef<Node | null>(null);
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const centerOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isDraggingCenterRef = useRef<boolean>(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Initialize nodes in a circular pattern
    const centerX = canvas.offsetWidth / 2;
    const centerY = canvas.offsetHeight / 2;
    const baseRadius = Math.min(centerX, centerY) * 0.6;

    nodesRef.current = validators.map((validator, i) => {
      const angle = (i / validators.length) * Math.PI * 2;
      const radius = baseRadius + (Math.random() - 0.5) * 50;
      return {
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        validator,
        angle,
        radius,
      };
    });

    // Animation loop
    const animate = () => {
      // Dark background fill with blue tint
      ctx.fillStyle = 'rgba(0, 5, 15, 0.95)';
      ctx.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);

      // Calculate current center with offset and spring back
      const trueCenterX = canvas.offsetWidth / 2;
      const trueCenterY = canvas.offsetHeight / 2;
      
      // Spring back to true center when not dragging
      if (!isDraggingCenterRef.current) {
        centerOffsetRef.current.x *= 0.95;
        centerOffsetRef.current.y *= 0.95;
        
        if (Math.abs(centerOffsetRef.current.x) < 0.5) centerOffsetRef.current.x = 0;
        if (Math.abs(centerOffsetRef.current.y) < 0.5) centerOffsetRef.current.y = 0;
      }
      
      const currentCenterX = trueCenterX + centerOffsetRef.current.x;
      const currentCenterY = trueCenterY + centerOffsetRef.current.y;

      // Subtle depth gradient
      const bgGradient = ctx.createRadialGradient(currentCenterX, currentCenterY, 0, currentCenterX, currentCenterY, baseRadius * 1.5);
      bgGradient.addColorStop(0, 'rgba(30, 58, 138, 0.15)');
      bgGradient.addColorStop(0.5, 'rgba(30, 58, 138, 0.05)');
      bgGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);

      // Draw central core - subtle hub
      const coreGradient = ctx.createRadialGradient(currentCenterX, currentCenterY, 0, currentCenterX, currentCenterY, 30);
      coreGradient.addColorStop(0, 'rgba(59, 130, 246, 0.8)');
      coreGradient.addColorStop(0.5, 'rgba(59, 130, 246, 0.3)');
      coreGradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
      ctx.fillStyle = coreGradient;
      ctx.beginPath();
      ctx.arc(currentCenterX, currentCenterY, 30, 0, Math.PI * 2);
      ctx.fill();
      
      // Core dot
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.shadowColor = 'rgba(59, 130, 246, 0.5)';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(currentCenterX, currentCenterY, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Minimal particles
      particlesRef.current = particlesRef.current.filter((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 1;
        
        if (p.life > 0) {
          const alpha = p.life / p.maxLife;
          ctx.fillStyle = `rgba(147, 197, 253, ${alpha * 0.3})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
          ctx.fill();
          return true;
        }
        return false;
      });

      // Occasional particles
      if (Math.random() < 0.1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.3 + Math.random() * 0.5;
        particlesRef.current.push({
          x: currentCenterX,
          y: currentCenterY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 80,
          maxLife: 80,
        });
      }

      // Draw clean mesh connections
      nodesRef.current.forEach((node, i) => {
        nodesRef.current.forEach((otherNode, j) => {
          if (i >= j) return;
          
          const dx = otherNode.x - node.x;
          const dy = otherNode.y - node.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          const maxDistance = 450;
          const opacity = Math.max(0, (1 - distance / maxDistance) * 0.5);
          
          if (opacity > 0.05) {
            const bothOnline = node.validator.online && otherNode.validator.online;
            
            if (bothOnline) {
              // Vibrant green connections for online validators
              const gradient = ctx.createLinearGradient(node.x, node.y, otherNode.x, otherNode.y);
              gradient.addColorStop(0, `rgba(16, 185, 129, ${opacity * 0.8})`);
              gradient.addColorStop(0.5, `rgba(52, 211, 153, ${opacity})`);
              gradient.addColorStop(1, `rgba(16, 185, 129, ${opacity * 0.8})`);
              ctx.strokeStyle = gradient;
              ctx.lineWidth = 1.5;
              ctx.shadowColor = 'rgba(16, 185, 129, 0.3)';
              ctx.shadowBlur = 4;
            } else if (node.validator.online || otherNode.validator.online) {
              ctx.strokeStyle = `rgba(100, 116, 139, ${opacity * 0.2})`;
              ctx.lineWidth = 0.5;
              ctx.setLineDash([5, 5]);
              ctx.shadowBlur = 0;
            } else {
              ctx.strokeStyle = `rgba(71, 85, 105, ${opacity * 0.15})`;
              ctx.lineWidth = 0.5;
              ctx.setLineDash([3, 7]);
              ctx.shadowBlur = 0;
            }
            
            ctx.beginPath();
            ctx.moveTo(node.x, node.y);
            ctx.lineTo(otherNode.x, otherNode.y);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.shadowBlur = 0;

            // Subtle data packets on green connections
            if (bothOnline && distance < 300 && Math.random() < 0.03) {
              const t = (Date.now() * 0.0005 + i * 0.1) % 1;
              const packetX = node.x + dx * t;
              const packetY = node.y + dy * t;
              
              ctx.fillStyle = 'rgba(52, 211, 153, 0.9)';
              ctx.shadowColor = 'rgba(16, 185, 129, 0.8)';
              ctx.shadowBlur = 8;
              ctx.beginPath();
              ctx.arc(packetX, packetY, 3, 0, Math.PI * 2);
              ctx.fill();
              ctx.shadowBlur = 0;
            }
          }
        });

        // Connection to center
        if (node.validator.online) {
          ctx.strokeStyle = 'rgba(16, 185, 129, 0.2)';
          ctx.lineWidth = 1;
        } else {
          ctx.strokeStyle = 'rgba(71, 85, 105, 0.1)';
          ctx.lineWidth = 0.5;
        }
        ctx.beginPath();
        ctx.moveTo(currentCenterX, currentCenterY);
        ctx.lineTo(node.x, node.y);
        ctx.stroke();
      });

      // Update node positions (gentle floating or spring back)
      nodesRef.current.forEach((node) => {
        if (node.isDragging) {
          // Node is being dragged, skip physics
          return;
        }

        // Calculate orbital target position using current center
        const targetX = currentCenterX + Math.cos(node.angle) * node.radius;
        const targetY = currentCenterY + Math.sin(node.angle) * node.radius;
        
        // Spring back to orbital position
        const dx = targetX - node.x;
        const dy = targetY - node.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 5) {
          // Strong spring force when far from orbit
          node.vx += dx * 0.003;
          node.vy += dy * 0.003;
        } else {
          // Gentle orbit when close
          node.angle += 0.0003;
          node.vx += (targetX - node.x) * 0.001;
          node.vy += (targetY - node.y) * 0.001;
        }
        
        node.vx *= 0.95;
        node.vy *= 0.95;
        
        node.x += node.vx;
        node.y += node.vy;
      });

      // Draw clean nodes
      nodesRef.current.forEach((node) => {
        const isOnline = node.validator.online;
        
        // Subtle glow
        const glowGradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, 15);
        if (isOnline) {
          glowGradient.addColorStop(0, 'rgba(59, 130, 246, 0.4)');
          glowGradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
        } else {
          glowGradient.addColorStop(0, 'rgba(100, 116, 139, 0.3)');
          glowGradient.addColorStop(1, 'rgba(100, 116, 139, 0)');
        }
        ctx.fillStyle = glowGradient;
        ctx.beginPath();
        ctx.arc(node.x, node.y, 15, 0, Math.PI * 2);
        ctx.fill();

        // Node circle
        ctx.fillStyle = isOnline ? 'rgba(147, 197, 253, 0.9)' : 'rgba(71, 85, 105, 0.6)';
        ctx.shadowColor = isOnline ? 'rgba(59, 130, 246, 0.5)' : 'transparent';
        ctx.shadowBlur = isOnline ? 8 : 0;
        ctx.beginPath();
        ctx.arc(node.x, node.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // White border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Center dot
        ctx.fillStyle = 'rgba(255, 255, 255, 1)';
        ctx.beginPath();
        ctx.arc(node.x, node.y, 2, 0, Math.PI * 2);
        ctx.fill();
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [validators]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const trueCenterX = canvas.offsetWidth / 2;
    const trueCenterY = canvas.offsetHeight / 2;
    const currentCenterX = trueCenterX + centerOffsetRef.current.x;
    const currentCenterY = trueCenterY + centerOffsetRef.current.y;

    // Handle dragging center
    if (isDraggingCenterRef.current && mouseDownPosRef.current) {
      const dx = x - mouseDownPosRef.current.x;
      const dy = y - mouseDownPosRef.current.y;
      centerOffsetRef.current = { x: dx, y: dy };
      return;
    }

    // Handle dragging node
    if (draggedNodeRef.current) {
      draggedNodeRef.current.x = x;
      draggedNodeRef.current.y = y;
      draggedNodeRef.current.vx = 0;
      draggedNodeRef.current.vy = 0;
      return;
    }

    // Handle hover
    const distToCenter = Math.sqrt(Math.pow(x - currentCenterX, 2) + Math.pow(y - currentCenterY, 2));
    if (distToCenter < 30) {
      // Hovering over center
      setHoveredNode(null);
      return;
    }

    const hoveredNode = nodesRef.current.find((node) => {
      const dx = node.x - x;
      const dy = node.y - y;
      return Math.sqrt(dx * dx + dy * dy) < 15;
    });

    setHoveredNode(hoveredNode?.validator || null);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const trueCenterX = canvas.offsetWidth / 2;
    const trueCenterY = canvas.offsetHeight / 2;
    const currentCenterX = trueCenterX + centerOffsetRef.current.x;
    const currentCenterY = trueCenterY + centerOffsetRef.current.y;

    // Check if clicking center
    const distToCenter = Math.sqrt(Math.pow(x - currentCenterX, 2) + Math.pow(y - currentCenterY, 2));
    if (distToCenter < 30) {
      isDraggingCenterRef.current = true;
      mouseDownPosRef.current = { x: x - centerOffsetRef.current.x, y: y - centerOffsetRef.current.y };
      return;
    }

    // Check if clicking a node
    const clickedNode = nodesRef.current.find((node) => {
      const dx = node.x - x;
      const dy = node.y - y;
      return Math.sqrt(dx * dx + dy * dy) < 15;
    });

    if (clickedNode) {
      draggedNodeRef.current = clickedNode;
      clickedNode.isDragging = true;
      mouseDownPosRef.current = { x, y };
    }
  };

  const handleMouseUp = () => {
    if (isDraggingCenterRef.current) {
      isDraggingCenterRef.current = false;
      mouseDownPosRef.current = null;
    }
    
    if (draggedNodeRef.current) {
      draggedNodeRef.current.isDragging = false;
      draggedNodeRef.current = null;
      mouseDownPosRef.current = null;
    }
  };

  return (
    <div className="relative w-full h-[700px] bg-gradient-to-br from-background/40 via-background/60 to-background/80 backdrop-blur-sm rounded-2xl border border-primary/20 overflow-hidden shadow-2xl">
      {/* Stats Overlay */}
      <div className="absolute top-6 left-6 z-10 flex flex-col gap-3">
        <div className="bg-background/80 backdrop-blur-xl border border-border/50 rounded-xl px-4 py-3 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
              <Activity className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">API Status</div>
              <div className="text-sm font-bold text-foreground">{health || 'Unknown'}</div>
            </div>
          </div>
        </div>

        <div className="bg-background/80 backdrop-blur-xl border border-border/50 rounded-xl px-4 py-3 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Validators Online</div>
              <div className="text-sm font-bold text-foreground">
                {onlineCount} / {validators.length}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="absolute top-6 right-6 z-10 bg-background/80 backdrop-blur-xl border border-border/50 rounded-xl px-4 py-3 shadow-lg">
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-muted-foreground">Online</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-slate-500" />
            <span className="text-muted-foreground">Offline</span>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          setHoveredNode(null);
          handleMouseUp();
        }}
      />

      {/* Hover Tooltip */}
      {hoveredNode && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 bg-background/95 backdrop-blur-xl border border-border/50 rounded-xl px-4 py-3 shadow-xl">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${hoveredNode.online ? 'bg-green-500' : 'bg-slate-500'}`} />
            <div>
              <div className="text-sm font-bold text-foreground">{hoveredNode.name}</div>
              <div className="text-xs text-muted-foreground">{hoveredNode.region}</div>
            </div>
          </div>
        </div>
      )}

      {/* Decorative Elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
      </div>
    </div>
  );
}
