import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { BiasAnalysis as BiasAnalysisType } from '@/types';

gsap.registerPlugin(useGSAP);

interface Props {
  bias: BiasAnalysisType;
}

export function BiasAnalysis({ bias }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!containerRef.current) return;

    gsap.from(containerRef.current.querySelectorAll('.bias-item'), {
      x: 20,
      opacity: 0,
      duration: 0.5,
      stagger: 0.1,
      ease: 'power2.out',
    });
  }, { scope: containerRef });

  const factPercent = bias.factOpinionRatio.fact;
  const opinionPercent = bias.factOpinionRatio.opinion;

  return (
    <Card ref={containerRef}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <span className="text-2xl">⚖️</span>
          편향성 분석
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bias-item space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">사실 vs 의견 비율</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-12">
              사실 {factPercent}%
            </span>
            <Progress value={factPercent} className="flex-1" />
            <span className="text-xs text-muted-foreground w-12 text-right">
              의견 {opinionPercent}%
            </span>
          </div>
        </div>

        {bias.missingContext && bias.missingContext.length > 0 && (
          <div className="bias-item space-y-2">
            <p className="text-sm font-medium">누락된 맥락</p>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {bias.missingContext.map((ctx, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>{ctx}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {bias.frame && (
          <div className="bias-item">
            <p className="text-sm">
              <span className="font-medium">기사 프레임: </span>
              <span className="text-muted-foreground">{bias.frame}</span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
