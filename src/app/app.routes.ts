import { Routes } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
import { GalleryComponent } from './components/gallery/gallery.component';
import { CategoryGalleryComponent } from './components/category-gallery/category-gallery.component';
import { AboutComponent } from './components/about/about.component';
import { NotFoundComponent } from './components/not-found/not-found.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'gallery', component: GalleryComponent },
  { path: 'gallery/:slug', component: CategoryGalleryComponent },
  { path: 'about', component: AboutComponent },
  { path: '**', component: NotFoundComponent },
];