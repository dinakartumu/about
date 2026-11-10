import * as Lightbox from '@ramka/react/lightbox';

// Every photo on a set page is its own island (PhotoTrigger), and the viewer is
// another (PhotoViewer). Islands are separate React roots, but they share this
// module, so this one handle is what ties the detached triggers to the Root.
export const photoLightbox = Lightbox.createHandle();

export const triggerId = (index: number) => `photo-${index}`;
