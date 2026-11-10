import * as React from 'react';
import * as Lightbox from '@ramka/react/lightbox';
import { photoLightbox } from './handle';
import './lightbox.css';

interface Item {
  url: string;
  id: string;
  w: number;
  h: number;
}

// Photo ids look like "pescadero/DSCF1598"; the set is already in the path,
// so the URL hash just carries the filename slug, e.g. #DSCF1598.
const slug = (id: string) => id.split('/').pop()!;

export default function PhotoViewer({ items }: { items: Item[] }) {
  const indexForHash = React.useCallback(() => {
    let s: string;
    try {
      s = decodeURIComponent(location.hash.slice(1));
    } catch {
      return -1;
    }
    return s ? items.findIndex((it) => slug(it.id) === s) : -1;
  }, [items]);

  // Local state is the viewer's source of truth and the hash mirrors it. The
  // URL is written from ramka's gesture callbacks, never from an effect, so
  // hash-driven changes (Back, deep links) can't echo back into history.
  const [open, setOpen] = React.useState(false);
  const [index, setIndex] = React.useState(0);
  const openRef = React.useRef(open);
  const indexRef = React.useRef(index);

  // Deep links on load, plus Back/Forward: open, navigate, or close to match.
  React.useEffect(() => {
    const sync = () => {
      const i = indexForHash();
      openRef.current = i !== -1;
      setOpen(i !== -1);
      if (i !== -1) {
        indexRef.current = i;
        setIndex(i);
      }
    };
    sync();
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, [indexForHash]);

  const hashFor = (i: number) => '#' + slug(items[i].id);

  const handleOpenChange = (next: boolean) => {
    openRef.current = next;
    setOpen(next);
    if (next) {
      // Opening pushes one entry, so Back closes the viewer instead of leaving.
      history.pushState(null, '', hashFor(indexRef.current));
    } else if (location.hash) {
      // Gesture closes rewrite the entry rather than popping it: history.back()
      // here would land a popstate (and scroll restoration) mid close-morph.
      history.replaceState(null, '', location.pathname + location.search);
    }
  };

  // A window resize (or phone rotation) moves the slide track under ramka, and
  // the browser reports that as a scroll before ramka's own resize pin kicks
  // in, so it reads a different photo off the stale offset. Ignore scroll-led
  // changes just after a resize; ramka's pin then restores the active photo.
  const resizedAt = React.useRef(0);
  React.useEffect(() => {
    const onResize = () => (resizedAt.current = performance.now());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const handleValueChange = (next: number, { source }: { source: string }) => {
    if (source === 'scroll' && performance.now() - resizedAt.current < 500) return;
    indexRef.current = next;
    setIndex(next);
    // A trigger tap reports its index before the open commits; the open writes
    // that URL. Swipes and arrow keys while open replace, so no history spam.
    if (openRef.current) history.replaceState(null, '', hashFor(next));
  };

  return (
    <Lightbox.Root
      handle={photoLightbox}
      open={open}
      onOpenChange={handleOpenChange}
      value={index}
      onValueChange={handleValueChange}
      count={items.length}
      scrollTriggerIntoView={[
        { type: 'onChange', behavior: 'instant' },
        { type: 'onOpenComplete', behavior: 'instant' },
      ]}
    >
      <Lightbox.Portal className="lb-portal">
        <Lightbox.Backdrop className="lb-backdrop" />
        <Lightbox.Content className="lb-content" aria-label="Photo viewer">
          <Lightbox.Slides className="lb-slides" aria-label="Photos" aria-roledescription="carousel">
            {items.map((item, i) => (
              <Lightbox.Slide key={item.id} className="lb-slide">
                <Lightbox.Item
                  index={i}
                  aria-roledescription="slide"
                  aria-label={`${i + 1} of ${items.length}`}
                >
                  <Lightbox.Zoom>
                    <Lightbox.Media width={item.w} height={item.h}>
                      <img src={item.url} width={item.w} height={item.h} alt="" />
                    </Lightbox.Media>
                  </Lightbox.Zoom>
                </Lightbox.Item>
              </Lightbox.Slide>
            ))}
          </Lightbox.Slides>
          <Lightbox.Close className="lb-control lb-close" aria-label="Close">
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3.5 3.5l9 9m0-9l-9 9" />
            </svg>
          </Lightbox.Close>
          {items.length > 1 && (
            <>
              <Lightbox.Previous className="lb-control lb-nav lb-prev" aria-label="Previous photo">
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M10 3L5 8l5 5" />
                </svg>
              </Lightbox.Previous>
              <Lightbox.Next className="lb-control lb-nav lb-next" aria-label="Next photo">
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M6 3l5 5-5 5" />
                </svg>
              </Lightbox.Next>
              <Lightbox.Counter className="lb-counter" />
            </>
          )}
        </Lightbox.Content>
      </Lightbox.Portal>
    </Lightbox.Root>
  );
}
