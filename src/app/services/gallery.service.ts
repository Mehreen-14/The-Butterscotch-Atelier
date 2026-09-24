import { Injectable, computed, signal } from '@angular/core';
import { GALLERY } from '../gallery-data';
import { GalleryCategory } from '../gallery-category.model';
import { LightboxItem } from './lightbox.service';

const VIDEO_EXT = /\.(mp4|mov|webm)$/i;

@Injectable({ providedIn: 'root' })
export class GalleryService {
  private readonly _categories = signal<GalleryCategory[]>(
    GALLERY.filter((category) => category.items.length > 0)
  );

  readonly categories = this._categories.asReadonly();
  readonly totalItems = computed(() =>
    this._categories().reduce((sum, category) => sum + category.items.length, 0)
  );

  getBySlug(slug: string): GalleryCategory | undefined {
    return this._categories().find((category) => category.slug === slug);
  }

  titleFrom(src: string): string {
    const parts = src.split('/');
    const file = parts[parts.length - 1];
    return file.replace(/\.[^.]+$/, '');
  }

  isVideo(src: string): boolean {
    return VIDEO_EXT.test(src);
  }

  toItem(src: string, categoryName: string): LightboxItem {
    return {
      src,
      title: this.titleFrom(src),
      category: categoryName,
      type: this.isVideo(src) ? 'video' : 'image',
    };
  }
}