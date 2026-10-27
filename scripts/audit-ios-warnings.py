"""Compare an Xcode issue-list export with an unfiltered xcodebuild log."""
import argparse
from collections import Counter
from pathlib import Path
import re

root = Path(__file__).resolve().parent.parent


def diagnostics(filename, build_log=False):
    items = []
    text = Path(filename).read_text()
    for line in text.splitlines():
        if build_log and ': warning:' not in line:
            continue
        match = re.match(r'(/.+?):(\d+):\d+(?:: warning: |\s+)(.*)', line)
        if not match:
            continue
        source, number, message = match.groups()
        source = str(Path(source).resolve())
        if '/Build/Products/' in source:
            source = '<build>/' + source.split('/Build/Products/', 1)[1].split('/', 1)[1]
        elif source.startswith(str(root) + '/'):
            source = source[len(str(root)) + 1:]
        message = re.sub(r'\s*\[(?:-W|#).*?\]', '', message).strip()
        items.append((source, number, message))
    return items, text.count('has no symbols')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--before', required=True)
    parser.add_argument('--after', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    before, old_empty = diagnostics(args.before)
    after, new_empty = diagnostics(args.after, True)
    report = ['# iPhone 编译警告核对', '',
              '统计的是含源文件位置的诊断；空目标文件的归档警告另列。没有关闭全局编译警告。', '',
              '| 项目 | 用户提供记录 | 最终完整构建 |', '| --- | ---: | ---: |',
              f'| 带位置的警告 | {len(before)} | {len(after)} |',
              f'| 按文件、行号与正文去重 | {len(set(before))} | {len(set(after))} |',
              f'| 空目标文件归档提示 | {old_empty} | {new_empty} |', '',
              '## 剩余警告分类', '', '| 警告正文 | 次数 |', '| --- | ---: |']
    for message, count in Counter(m for _, _, m in after).most_common():
        report.append(f'| {message.replace("|", "/")} | {count} |')
    report += ['', '## 剩余位置', '']
    for source, number, message in sorted(set(after)):
        report.append(f'- `{source}:{number}` — {message}')
    Path(args.output).write_text('\n'.join(report) + '\n')
    print(f'Source warnings {len(before)} -> {len(after)}; unique {len(set(before))} -> {len(set(after))}; archive notices {old_empty} -> {new_empty}')


if __name__ == '__main__':
    main()
