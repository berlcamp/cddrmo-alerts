'use client';

import { Link2, Share2 } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { FacebookIcon } from '@/components/facebook-icon';
import { Button, buttonVariants } from '@/components/ui/button';
import { facebookShareUrl } from '@/lib/site';
import { cn } from '@/lib/utils';

const noopSubscribe = () => () => {};

export function ShareButtons({ url, title }: { url: string; title: string }) {
  const canShare = useSyncExternalStore(noopSubscribe, () => typeof navigator.share === 'function', () => false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy. Copy the link from the address bar instead.');
    }
  }

  async function share() {
    try {
      await navigator.share({ title, url });
    } catch {
      // The viewer closed the share sheet.
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <a
        href={facebookShareUrl(url)}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(buttonVariants({ size: 'lg' }), 'h-11 bg-[#0866FF] text-white hover:bg-[#0757D9]')}
      >
        <FacebookIcon className="size-5" />
        Share on Facebook
      </a>
      <Button type="button" variant="outline" size="lg" className="h-11 cursor-pointer" onClick={copy}>
        <Link2 aria-hidden /> Copy link
      </Button>
      {canShare && (
        <Button type="button" variant="outline" size="lg" className="h-11 cursor-pointer" onClick={share}>
          <Share2 aria-hidden /> Share…
        </Button>
      )}
    </div>
  );
}
