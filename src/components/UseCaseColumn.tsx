import React from 'react';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';

export interface UseCase {
  /** Profession + ville, ex: "Carreleur · Paris" */
  trade: string;
  /** Le scénario terrain. Pas un faux verbatim de client. */
  situation: string;
  /** Ce que Photofacto fait dans ce scénario. */
  action: string;
  /** Le résultat concret pour l'artisan. */
  result: string;
}

interface UseCaseColumnProps {
  className?: string;
  cases: UseCase[];
  duration?: number;
}

export const UseCaseColumn: React.FC<UseCaseColumnProps> = ({
  className,
  cases,
  duration = 18,
}) => {
  return (
    <div className={className}>
      <motion.div
        animate={{ translateY: '-50%' }}
        transition={{
          duration,
          repeat: Infinity,
          ease: 'linear',
          repeatType: 'loop',
        }}
        className="flex flex-col gap-5 pb-5"
      >
        {[...new Array(2).fill(0)].map((_, loop) => (
          <React.Fragment key={loop}>
            {cases.map(({ trade, situation, action, result }, i) => (
              <div
                key={i}
                className="p-6 rounded-3xl border-spark bg-white shadow-spark-sm max-w-xs w-full"
              >
                <div className="text-[10px] font-bold uppercase tracking-wider text-primary mb-3">
                  {trade}
                </div>
                <div className="space-y-3.5">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-1">
                      Situation
                    </div>
                    <div className="text-[13px] text-on-surface leading-relaxed">
                      {situation}
                    </div>
                  </div>
                  <div className="border-t border-on-surface-variant/10 pt-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-1">
                      Photofacto
                    </div>
                    <div className="text-[13px] text-on-surface leading-relaxed">
                      {action}
                    </div>
                  </div>
                  <div className="bg-primary/5 -mx-2 px-3 py-2.5 rounded-xl flex items-start gap-2">
                    <ArrowRight
                      className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0"
                      strokeWidth={3}
                    />
                    <div className="text-[12px] font-bold text-secondary-dim leading-snug">
                      {result}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </React.Fragment>
        ))}
      </motion.div>
    </div>
  );
};
