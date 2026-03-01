const {
  determineNextVersion,
  findVersionsInChangelogJson,
  findVersionsInChangelogMarkdown,
} = require('../scripts/determine-next-version.cjs');

describe('determine-next-version script', () => {
  test('uses the explicit changelog version when it is ahead of tags', () => {
    const version = determineNextVersion({
      latestTag: 'v1.1.123',
      changelogMarkdown: '## 1.2.0 - 2026-03-01\n- Prepare release.',
      changelogJson: JSON.stringify([{ version: '1.2.0', date: '2026-03-01', changes: ['Prepare release.'] }]),
    });

    expect(version).toBe('1.2.0');
  });

  test('bumps patch when changelog does not define a newer version', () => {
    const version = determineNextVersion({
      latestTag: 'v1.1.123',
      changelogMarkdown: '## 1.1.123 - 2026-03-01\n- Existing release.',
      changelogJson: JSON.stringify([{ version: '1.1.123', date: '2026-03-01', changes: ['Existing release.'] }]),
    });

    expect(version).toBe('1.1.124');
  });

  test('findVersionsInChangelogMarkdown ignores placeholder entries', () => {
    const versions = findVersionsInChangelogMarkdown(
      '## [NEXT_VERSION] - [NEXT_DATE]\n- Upcoming release.\n\n## 1.1.123 - 2026-03-01\n- Existing release.',
    );

    expect(versions).toEqual(['1.1.123']);
  });

  test('findVersionsInChangelogJson ignores placeholders and invalid versions', () => {
    const versions = findVersionsInChangelogJson(
      JSON.stringify([
        { version: '[NEXT_VERSION]' },
        { version: '1.2.0' },
        { version: 'bad.version' },
      ]),
    );

    expect(versions).toEqual(['1.2.0']);
  });
});
