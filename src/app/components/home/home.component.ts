import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GalleryService } from '../../services/gallery.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  private readonly gallery = inject(GalleryService);

  readonly totalItems = this.gallery.totalItems;
}