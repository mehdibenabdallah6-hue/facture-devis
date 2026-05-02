import React, { useState } from 'react';
import { motion } from 'motion/react';

export interface Testimonial {
  quote: string;
  /** Profession + ville facultative, ex: "Électricien" ou "Plombier · Lyon". */
  trade: string;
}

interface TestimonialColumnProps {
  className?: string;
  testimonials: Testimonial[];
  duration?: number;
}

export const TestimonialColumn: React.FC<TestimonialColumnProps> = ({
  className,
  testimonials,
  duration = 18,
}) => {
  // Pause the auto-scroll when the user is reading a card. Using a state
  // toggle (rather than CSS animation-play-state) because we drive the
  // motion via React props, not a CSS keyframe animation.
  const [paused, setPaused] = useState(false);

  return (
    <div
      className={className}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <motion.div
        animate={paused ? undefined : { translateY: '-50%' }}
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
            {testimonials.map(({ quote, trade }, i) => (
              <article
                key={i}
                className="group p-6 md:p-7 rounded-3xl border-spark bg-white shadow-spark-sm max-w-xs w-full transition-all duration-200 ease-out hover:shadow-spark-md hover:-translate-y-0.5 hover:border-primary/30"
              >
                <p className="text-[14px] md:text-[15px] text-on-surface leading-[1.55]">
                  {quote}
                </p>
                <div className="mt-4 pt-3 border-t border-on-surface-variant/10 flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="block w-6 h-px bg-primary/60 transition-all duration-200 group-hover:w-8"
                  />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant group-hover:text-primary transition-colors">
                    {trade}
                  </span>
                </div>
              </article>
            ))}
          </React.Fragment>
        ))}
      </motion.div>
    </div>
  );
};
