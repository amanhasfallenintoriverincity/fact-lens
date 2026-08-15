import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { EmotionScores } from '@/types';

gsap.registerPlugin(useGSAP);

interface Props {
  emotions: EmotionScores;
}

const EMOTION_COLORS: Record<string, string> = {
  '화남/분노': 'bg-red-500',
  '슬픔': 'bg-blue-500',
  '공포/무서움': 'bg-purple-500',
  '불안/걱정': 'bg-orange-500',
  '증오/혐오': 'bg-rose-600',
  '기쁨': 'bg-yellow-500',
  '행복': 'bg-green-500',
  '고마움': 'bg-emerald-500',
  '감동/감탄': 'bg-pink-500',
  '편안/쾌적': 'bg-teal-500',
};

export function EmotionAnalysis({ emotions }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  const sorted = Object.entries(emotions)
    .filter(([, score]) => score > 10)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  useGSAP(() => {
    if (!containerRef.current) return;

    gsap.from(containerRef.current.querySelectorAll('.emotion-item'), {
      x: -20,
      opacity: 0,
      duration: 0.5,
      stagger: 0.1,
      ease: 'power2.out',
    });
  }, { scope: containerRef });

  if (sorted.length === 0) {
    return null;
  }

  return (
    <Card ref={containerRef} className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <span className="text-2xl">😊</span>
          감정 분석
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {sorted.map(([emotion, score]) => {
          const colorClass = EMOTION_COLORS[emotion] || 'bg-primary';
          
          return (
            <div key={emotion} className="emotion-item space-y-2">
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="font-medium">
                  {emotion}
                </Badge>
                <span className="text-sm font-semibold text-muted-foreground">
                  {score}%
                </span>
              </div>
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full ${colorClass} transition-all duration-1000 ease-out`}
                  style={{ width: `${score}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
