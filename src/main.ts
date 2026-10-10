/*
 * Copyright (c) Cashikoi. All rights reserved.
 * This file is subject to the terms and conditions defined in file 'LICENSE.txt', which is part of this source code package.
 */
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, appConfig).catch((err) => console.error(err));
