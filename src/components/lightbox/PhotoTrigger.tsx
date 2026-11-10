import * as Lightbox from '@ramka/react/lightbox';
import { photoLightbox, triggerId } from './handle';

interface Props {
  index: number;
  href: string;
  src: string;
  srcset?: string;
  sizes?: string;
  width: number;
  height: number;
}

// Rendered as a real link to the full-size photo, so the grid still works
// before hydration (or without JS); once hydrated, ramka takes the click and
// morphs the thumbnail into the viewer.
export default function PhotoTrigger({ index, href, src, srcset, sizes, width, height }: Props) {
  return (
    <Lightbox.Trigger
      handle={photoLightbox}
      id={triggerId(index)}
      index={index}
      render={
        <a
          className="photo-link"
          href={href}
          aria-label={`View photo ${index + 1} full screen`}
          onClick={(e) => e.preventDefault()}
        />
      }
    >
      {({ imageRef }) => (
        <img
          ref={imageRef}
          src={src}
          srcSet={srcset}
          sizes={srcset ? sizes : undefined}
          width={width}
          height={height}
          alt=""
          loading={index < 2 ? 'eager' : 'lazy'}
          decoding="async"
        />
      )}
    </Lightbox.Trigger>
  );
}
