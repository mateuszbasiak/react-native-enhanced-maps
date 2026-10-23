import path from 'node:path';

export const cleanTargets = [
  'packages/maps/lib',
  'artifacts/codegen',
  'artifacts/bundles',
  'artifacts/packages',
  'artifacts/native-tests',
];

/** Return an inspectable plan; no subprocesses, writes or secret values here. */
export function projectCommand(
  action,
  args = [],
  { root, platform = process.platform, node = process.execPath },
) {
  const step = (command, commandArgs, directory, env = {}) => ({
    command,
    args: commandArgs,
    cwd: path.join(root, directory),
    env,
  });
  const cli = path.join(root, 'node_modules/react-native/cli.js');
  if (['ios', 'pods', 'build:ios'].includes(action) && platform !== 'darwin')
    throw new Error('iOS commands require macOS with Xcode and CocoaPods');
  switch (action) {
    case 'ios':
      return [
        step(
          node,
          [cli, 'run-ios', '--port', '8088', '--no-packager', ...args],
          'example',
        ),
      ];
    case 'android':
      return [
        step(
          node,
          [cli, 'run-android', '--port', '8088', '--no-packager', ...args],
          'example',
        ),
      ];
    case 'pods':
      return [step('pod', ['install', ...args], 'example/ios')];
    case 'build:ios':
      return [
        step(
          'xcodebuild',
          [
            '-workspace',
            'EnhancedMapsExample.xcworkspace',
            '-scheme',
            'EnhancedMapsExample',
            '-configuration',
            'Debug',
            '-sdk',
            'iphonesimulator',
            '-destination',
            'generic/platform=iOS Simulator',
            '-derivedDataPath',
            'build/DerivedData',
            'CODE_SIGNING_ALLOWED=NO',
            ...args,
            'build',
          ],
          'example/ios',
        ),
      ];
    case 'build:android':
      if (platform === 'win32')
        throw new Error(
          'Native build helpers currently support macOS and Linux',
        );
      return [
        step(
          './gradlew',
          [
            ':app:assembleDebug',
            '--no-daemon',
            '-PreactNativeDevServerPort=8088',
            ...args,
          ],
          'example/android',
        ),
      ];
    default:
      throw new Error(`Unknown project command: ${action}`);
  }
}
