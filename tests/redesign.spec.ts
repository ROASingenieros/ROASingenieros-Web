import { test, expect } from '@playwright/test';

test.describe('ROAS Ingenieros - Visual & Functional Redesign Suite', () => {
  const BASE_URL = 'http://localhost:5175';

  test('Public Site: Loads correctly, toggle theme, captures desktop/tablet/mobile screens', async ({ page }) => {
    // 1. Desktop Viewport (1280 x 800)
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    // Verify title and main elements
    await expect(page).toHaveTitle(/ROAS Ingenieros/i);
    await expect(page.locator('.desktop-nav')).toBeVisible();
    await expect(page.locator('.hero-badge')).toBeVisible();

    // Verify default theme is dark and html has data-theme="dark"
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-theme', 'dark');

    // Screenshot Desktop Dark Mode
    await page.screenshot({ path: 'tests/screenshots/desktop-dark-home.png', fullPage: false });

    // 2. Theme Toggle to Light Mode
    const themeBtn = page.locator('.theme-toggle-header');
    await expect(themeBtn).toBeVisible();
    await themeBtn.click();
    await expect(html).toHaveAttribute('data-theme', 'light');

    // Screenshot Desktop Light Mode
    await page.screenshot({ path: 'tests/screenshots/desktop-light-home.png', fullPage: false });

    // Toggle back to Dark Mode for remaining screenshots
    await themeBtn.click();
    await expect(html).toHaveAttribute('data-theme', 'dark');

    // 3. Navigate to Servicios
    const serviciosLink = page.locator('.desktop-nav a[href="#services"]');
    await serviciosLink.click();
    await page.waitForTimeout(600); // allow page transition to complete
    await expect(page.locator('.services-container')).toBeVisible();
    await page.screenshot({ path: 'tests/screenshots/desktop-servicios.png', fullPage: false });

    // 4. Navigate to Productos (Catálogo)
    const catalogoLink = page.locator('.desktop-nav a[href="#catalog"]');
    await catalogoLink.click();
    await page.waitForTimeout(700);
    await expect(page.locator('.catalog-container')).toBeVisible();
    // Wait for product card to load from Supabase
    await page.waitForSelector('.product-card, .catalog-empty-db', { timeout: 10000 });
    await page.screenshot({ path: 'tests/screenshots/desktop-catalogo.png', fullPage: false });

    // 5. Test Cart flow: Add item and verify drawer
    const addCartBtn = page.locator('.add-to-cart-btn').first();
    if (await addCartBtn.isVisible()) {
      await addCartBtn.click();
      await page.waitForTimeout(400);
      
      // Open cart drawer
      const cartTrigger = page.locator('.cart-toggle-header');
      await cartTrigger.click();
      await page.waitForTimeout(400);
      
      await expect(page.locator('.cart-modal')).toBeVisible();
      await page.screenshot({ path: 'tests/screenshots/desktop-cart-drawer.png', fullPage: false });

      // Close cart drawer
      const closeCartBtn = page.locator('.close-cart-btn');
      if (await closeCartBtn.isVisible()) {
        await closeCartBtn.click();
        await page.waitForTimeout(300);
      }
    }

    // 6. Navigate to Contacto
    const contactoLink = page.locator('.desktop-nav a[href="#contact"]');
    await contactoLink.click();
    await page.waitForTimeout(600);
    await expect(page.locator('.contact-container')).toBeVisible();
    await page.screenshot({ path: 'tests/screenshots/desktop-contacto.png', fullPage: false });

    // 7. Tablet Viewport (768 x 1024)
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'tests/screenshots/tablet-view.png', fullPage: false });

    // 8. Mobile Viewport (375 x 667)
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'tests/screenshots/mobile-view.png', fullPage: false });

    // Test mobile drawer toggle
    const hamburger = page.locator('.mobile-menu-toggle');
    if (await hamburger.isVisible()) {
      await hamburger.click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: 'tests/screenshots/mobile-menu.png', fullPage: false });
    }
  });

  test('Gestión ERP Portal: Check login page visual styling', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    // Hash routing for ERP is #/gestion
    await page.goto(`${BASE_URL}/#/gestion`, { waitUntil: 'networkidle' });

    const loginBox = page.locator('.g-login-caja, .g-shell');
    await expect(loginBox.first()).toBeVisible();
    await page.screenshot({ path: 'tests/screenshots/gestion-portal.png', fullPage: false });
  });
});

