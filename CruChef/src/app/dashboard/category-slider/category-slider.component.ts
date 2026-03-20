import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

import { Category } from '../../models/category.model';

@Component({
  selector: 'app-category-slider',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './category-slider.component.html',
  styleUrl: './category-slider.component.css',
})
export class CategorySliderComponent {
  @Input({ required: true }) categories: Category[] = [];
  @Input({ required: true }) selectedCategoryId = 'all';
  @Output() categoryChange = new EventEmitter<string>();
}
