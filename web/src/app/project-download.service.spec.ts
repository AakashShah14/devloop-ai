import { TestBed } from '@angular/core/testing';
import JSZip from 'jszip';
import { ProjectDownloadService } from './project-download.service';

describe('ProjectDownloadService', () => {
  let service: ProjectDownloadService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ProjectDownloadService);
  });

  it('preserves Python project files and nested paths in the ZIP', async () => {
    const blob = await service.createArchive([
      { path: 'pyproject.toml', content: '[project]\nname = "demo"' },
      { path: 'src/demo/main.py', content: 'def main():\n    print("hello")' },
    ]);
    const archive = await JSZip.loadAsync(blob);

    expect(await archive.file('pyproject.toml')?.async('string')).toContain('name = "demo"');
    expect(await archive.file('src/demo/main.py')?.async('string')).toContain('def main');
  });

  it('creates a conservative archive filename', () => {
    expect(service.archiveName('Set up an Initial Python Project!', 3)).toBe(
      'devloop-set-up-an-initial-python-project-v3.zip',
    );
  });

  it('falls back when the requirement has no filename-safe words', () => {
    expect(service.archiveName('✨✨✨✨✨', 2)).toBe('devloop-project-v2.zip');
  });

  it('rejects unsafe paths before they reach JSZip', async () => {
    await expectAsync(
      service.createArchive([{ path: '../secret', content: 'x' }]),
    ).toBeRejectedWithError('Invalid project file manifest.');
  });

  it('rejects duplicate paths instead of silently overwriting a project file', async () => {
    await expectAsync(
      service.createArchive([
        { path: 'src/main.py', content: 'print("first")' },
        { path: 'src/main.py', content: 'print("second")' },
      ]),
    ).toBeRejectedWithError('Invalid project file manifest.');
  });

  it('uses a mounted download link and revokes the object URL after the click', async () => {
    spyOn(URL, 'createObjectURL').and.returnValue('blob:devloop-test');
    const revoke = spyOn(URL, 'revokeObjectURL');
    const click = spyOn(HTMLAnchorElement.prototype, 'click');

    await service.download(
      [{ path: 'src/main.py', content: 'print("hello")' }],
      'Set up a Python project',
      1,
    );

    expect(click).toHaveBeenCalled();
    expect(document.querySelector('a[download]')).toBeNull();
    expect(revoke).not.toHaveBeenCalled();
    await new Promise((resolve) => window.setTimeout(resolve));
    expect(revoke).toHaveBeenCalledWith('blob:devloop-test');
  });
});
