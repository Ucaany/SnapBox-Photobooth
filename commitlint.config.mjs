/**
 * Commitlint SnapBox.
 * Format: `type(scope): subject` mengikuti Conventional Commits.
 * Contoh: `feat(web): tambah wizard provisioning tenant`
 */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'header-max-length': [2, 'always', 100],
    // `subject-case` dimatikan: pesan commit ditulis Bahasa Indonesia dan
    // sering memuat akronim (API, QRIS, RLS) yang ditolak aturan casing.
    'subject-case': [0],
    // Body boleh memuat URL panjang (mis. link PRD) tanpa kena limit.
    'body-max-line-length': [0],
    'scope-enum': [
      2,
      'always',
      ['web', 'desktop', 'db', 'ui', 'shared', 'config', 'ci', 'deps', 'repo', 'docs', 'release'],
    ],
    'type-enum': [
      2,
      'always',
      [
        'build',
        'chore',
        'ci',
        'docs',
        'feat',
        'fix',
        'perf',
        'refactor',
        'revert',
        'style',
        'test',
      ],
    ],
  },
};
