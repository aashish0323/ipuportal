const puppeteer = require('puppeteer');

class IPUResultScraper {
  constructor() {
    this.browser = null;
  }

  async init() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: "new",
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu'
        ]
      });
    }
  }

  async fetchResult(rollNumber, password, semester) {
    const page = await this.browser.newPage();
    
    try {
      // Set realistic viewport and user agent
      await page.setViewport({ width: 1366, height: 768 });
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

      // Go to IPU result page
      await page.goto('https://results.ipu.ac.in/', { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });

      // Wait for login form
      await page.waitForSelector('input[name="rollno"]', { timeout: 10000 });

      // Fill credentials
      await page.type('input[name="rollno"]', rollNumber);
      await page.type('input[name="password"]', password);
      
      // Select semester if dropdown exists
      if (semester) {
        await page.select('select[name="semester"]', semester).catch(() => {});
      }

      // Solve CAPTCHA manually - wait for user input or use service
      // For now, we'll wait for manual CAPTCHA solving (max 60 seconds)
      console.log('Waiting for CAPTCHA solving...');
      
      // Click submit
      await page.click('input[type="submit"]');

      // Wait for result page
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});

      // Extract result data
      const result = await this.extractResultData(page);

      await page.close();
      return result;

    } catch (error) {
      await page.close();
      throw new Error(`Failed to fetch result: ${error.message}`);
    }
  }

  async extractResultData(page) {
    // Extract student info
    const studentInfo = await page.evaluate(() => {
      const info = {};
      const rows = document.querySelectorAll('table tr');
      
      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 2) {
          const label = cells[0].textContent.trim().toLowerCase();
          const value = cells[1].textContent.trim();
          
          if (label.includes('name')) info.name = value;
          if (label.includes('roll')) info.rollNumber = value;
          if (label.includes('semester')) info.semester = value;
          if (label.includes('branch')) info.branch = value;
        }
      });
      
      return info;
    });

    // Extract marks table
    const subjects = await page.evaluate(() => {
      const subjects = [];
      const tables = document.querySelectorAll('table');
      
      tables.forEach(table => {
        const rows = table.querySelectorAll('tr');
        
        rows.forEach((row, index) => {
          if (index === 0) return; // Skip header
          
          const cells = row.querySelectorAll('td');
          if (cells.length >= 5) {
            const subject = {
              code: cells[0]?.textContent.trim() || '',
              name: cells[1]?.textContent.trim() || '',
              credits: parseFloat(cells[2]?.textContent.trim()) || 0,
              grade: cells[3]?.textContent.trim() || '',
              points: cells[4]?.textContent.trim() || ''
            };
            
            if (subject.code && subject.grade) {
              subjects.push(subject);
            }
          }
        });
      });
      
      return subjects;
    });

    // Calculate SGPA
    const sgpa = this.calculateSGPA(subjects);

    return {
      success: true,
      studentInfo,
      subjects,
      sgpa,
      timestamp: new Date().toISOString()
    };
  }

  calculateSGPA(subjects) {
    const gradePoints = {
      'O': 10, 'A+': 9, 'A': 8, 'B+': 7, 'B': 6, 'C': 5, 'S': 0, 'F': 0
    };

    let totalPoints = 0;
    let totalCredits = 0;

    subjects.forEach(sub => {
      const points = gradePoints[sub.grade] || 0;
      totalPoints += points * sub.credits;
      totalCredits += sub.credits;
    });

    return totalCredits > 0 ? (totalPoints / totalCredits).toFixed(2) : '0.00';
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

module.exports = new IPUResultScraper();