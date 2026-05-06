import { useEffect } from 'react';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  MINI_DEMO_ALT,
  MINI_DEMO_CTA,
  MINI_DEMO_IMAGE_HEIGHT,
  MINI_DEMO_IMAGE_SRC,
  MINI_DEMO_IMAGE_WIDTH,
  MINI_DEMO_LABEL,
  MINI_DEMO_REASSURANCE,
  MINI_DEMO_SUBTITLE,
  MINI_DEMO_TITLE,
} from '../lib/miniDevisDemo';
import { track } from '../services/analytics';

interface MiniDevisDemoProps {
  registerHref?: string;
  page?: string;
}

export function MiniDevisDemo({
  registerHref = '/inscription?mode=register',
  page = 'marketing',
}: MiniDevisDemoProps) {
  const navigate = useNavigate();

  useEffect(() => {
    track('demo_viewed', { page });
  }, [page]);

  const handlePrimaryCta = () => {
    track('demo_cta_clicked', { page, cta: 'create_first_quote' });
    navigate(registerHref);
  };

  return (
    <div className="relative overflow-hidden rounded-[32px] border-spark bg-white px-5 py-6 shadow-spark-lg sm:px-6 md:px-8 md:py-8 lg:px-10 lg:py-10">
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-primary/[0.06] to-transparent pointer-events-none" />

      <div className="relative grid items-center gap-8 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] lg:gap-10">
        <div className="max-w-xl">
          <div className="inline-flex items-center rounded-full border border-primary/15 bg-primary/[0.06] px-3 py-1 text-[11px] font-black uppercase tracking-[0.26em] text-primary">
            {MINI_DEMO_LABEL}
          </div>

          <h2 className="mt-4 font-headline text-3xl font-extrabold leading-tight text-secondary-dim md:text-[42px]">
            {MINI_DEMO_TITLE}
          </h2>

          <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-on-surface-variant md:text-base">
            {MINI_DEMO_SUBTITLE}
          </p>

          <div className="mt-6 flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <button
              type="button"
              onClick={handlePrimaryCta}
              className="min-touch inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-bold text-white shadow-spark-cta transition-all duration-200 hover:-translate-y-0.5 hover:shadow-spark-cta-lg active:scale-[0.98]"
            >
              {MINI_DEMO_CTA}
              <ArrowRight className="h-4 w-4" />
            </button>

            <span className="text-xs font-semibold text-on-surface-variant">
              {MINI_DEMO_REASSURANCE}
            </span>
          </div>
        </div>

        <div className="w-full">
          <div className="overflow-hidden rounded-[28px] border border-primary/10 bg-white shadow-2xl shadow-primary/[0.08]">
            <img
              src={MINI_DEMO_IMAGE_SRC}
              alt={MINI_DEMO_ALT}
              width={MINI_DEMO_IMAGE_WIDTH}
              height={MINI_DEMO_IMAGE_HEIGHT}
              loading="lazy"
              decoding="async"
              className="block h-auto w-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
