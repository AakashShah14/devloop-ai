import { Injectable } from '@angular/core';
import JSZip from 'jszip';
import type { ProjectFile } from './models';

@Injectable({ providedIn: 'root' })
export class ProjectDownloadService {
  async createArchive(files: ProjectFile[]): Promise<Blob> {
    this.assertSafeFiles(files);
    const zip = new JSZip();
    for (const file of files) zip.file(file.path, file.content);
    return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  }

  archiveName(requirement: string, iteration: number): string {
    const slug = requirement
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48)
      .replace(/-$/g, '');
    return `devloop-${slug || 'project'}-v${iteration}.zip`;
  }

  async download(files: ProjectFile[], requirement: string, iteration: number): Promise<void> {
    const blob = await this.createArchive(files);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = this.archiveName(requirement, iteration);
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private assertSafeFiles(files: ProjectFile[]): void {
    const uniquePaths = new Set(files.map((file) => file.path));
    const pathsAreSafe =
      files.length > 0 &&
      files.length <= 50 &&
      uniquePaths.size === files.length &&
      files.every((file) => {
        const segments = file.path.split('/');
        return (
          file.content.length <= 100_000 &&
          !file.path.startsWith('/') &&
          !/^[a-zA-Z]:\//.test(file.path) &&
          !file.path.includes('\\') &&
          !file.path.includes('\0') &&
          segments.every((segment) => segment !== '' && segment !== '.' && segment !== '..')
        );
      });
    const totalSize = files.reduce((total, file) => total + file.content.length, 0);
    if (!pathsAreSafe || totalSize > 500_000) {
      throw new Error('Invalid project file manifest.');
    }
  }
}
