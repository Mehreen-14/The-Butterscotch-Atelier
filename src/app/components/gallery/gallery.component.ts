import { Component, computed, inject, signal } from '@angular/core';
import { GalleryService } from '../../services/gallery.service';
import { LightboxItem, LightboxService } from '../../services/lightbox.service';

@Component({
  selector: 'app-gallery',
  standalone: true,
  imports: [],
  templateUrl: './gallery.component.html',
  styleUrl: './gallery.component.scss',
})
export class GalleryComponent {
  private readonly gallery = inject(GalleryService);
  private readonly lightbox = inject(LightboxService);

  readonly activeSlug = signal<string | null>(null);

  readonly categories = this.gallery.categories;
  readonly totalItems = this.gallery.totalItems;

  readonly visibleItems = computed<LightboxItem[]>(() => {
    const active = this.activeSlug();
    const items: LightboxItem[] = [];
    for (const category of this.categories()) {
      if (active && category.slug !== active) continue;
      for (const src of category.items) {
        items.push(this.gallery.toItem(src, category.name));
      }
    }
    return items;
  });

  setCategory(slug: string | null) {
    this.activeSlug.set(slug);
  }

  open(index: number) {
    this.lightbox.show(this.visibleItems(), index);
  }
}