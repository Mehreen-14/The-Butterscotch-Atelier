import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { GalleryService } from '../../services/gallery.service';
import { LightboxItem, LightboxService } from '../../services/lightbox.service';

@Component({
  selector: 'app-category-gallery',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './category-gallery.component.html',
  styleUrl: './category-gallery.component.scss',
})
export class CategoryGalleryComponent {
  private readonly gallery = inject(GalleryService);
  private readonly lightbox = inject(LightboxService);

  private readonly slug = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('slug') ?? '')),
    { initialValue: '' }
  );

  readonly categories = this.gallery.categories;

  readonly category = computed(() => {
    const slug = this.slug();
    return slug ? this.gallery.getBySlug(slug) : undefined;
  });

  readonly items = computed<LightboxItem[]>(() => {
    const category = this.category();
    if (!category) return [];
    return category.items.map((src) => this.gallery.toItem(src, category.name));
  });

  open(index: number) {
    this.lightbox.show(this.items(), index);
  }
}