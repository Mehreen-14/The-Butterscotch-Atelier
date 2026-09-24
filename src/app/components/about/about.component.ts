import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GalleryService } from '../../services/gallery.service';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss',
})
export class AboutComponent {
  private readonly gallery = inject(GalleryService);
  readonly totalItems = this.gallery.totalItems;
  readonly categoryCount = this.gallery.categories().length;
}