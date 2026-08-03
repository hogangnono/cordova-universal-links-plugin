/**
Hook is executed at the end of the 'prepare' stage. Usually, when you call 'cordova build'.

It will inject required preferences in the platform-specific projects, based on <universal-links>
data you have specified in the projects config.xml file.
*/

var configParser = require('./lib/configXmlParser.js');
var androidManifestWriter = require('./lib/android/manifestWriter.js');
var androidWebHook = require('./lib/android/webSiteHook.js');
var iosProjectEntitlements = require('./lib/ios/projectEntitlements.js');
var iosAppSiteAssociationFile = require('./lib/ios/appleAppSiteAssociationFile.js');
var iosProjectPreferences = require('./lib/ios/xcodePreferences.js');
var ANDROID = 'android';
var IOS = 'ios';

module.exports = function(ctx) {
  run(ctx);
};

/**
 * Execute hook.
 *
 * @param {Object} cordovaContext - cordova context object
 */
function run(cordovaContext) {
  var pluginPreferences = configParser.readPreferences(cordovaContext);
  var platformsList = cordovaContext.opts.cordova.platforms;

  // if no preferences are found - exit
  if (pluginPreferences == null) {
    return;
  }

  // if no host is defined - exit
  if (pluginPreferences.hosts == null || pluginPreferences.hosts.length == 0) {
    console.warn('No host is specified in the config.xml. Universal Links plugin is not going to work.');
    return;
  }

  // phase-mode 가 지정된 host 는 비-prod phase 빌드에서 phase 서브도메인으로 변환한다.
  // 여기서 한 번 변환하면 iOS entitlement / Android intent-filter / AASA 가 모두 이 host 를 사용한다.
  applyPhaseSubdomain(cordovaContext, pluginPreferences);

  platformsList.forEach(function(platform) {
    switch (platform) {
      case ANDROID:
        {
          activateUniversalLinksInAndroid(cordovaContext, pluginPreferences);
          break;
        }
      case IOS:
        {
          activateUniversalLinksInIos(cordovaContext, pluginPreferences);
          break;
        }
    }
  });
}

/**
 * phase-mode 가 지정된 host 의 name 을 `{phase}.{name}` 으로 변환한다 (비-prod phase 빌드).
 * phase-mode 미지정 host(onelink 등) 와 prod 은 그대로 둔다.
 * 특정 도메인을 하드코딩하지 않고 config.xml 의 host + cordova --phase 로만 파생한다.
 *
 * @param {Object} cordovaContext - cordova context object
 * @param {Object} pluginPreferences - plugin preferences from config.xml
 */
function applyPhaseSubdomain(cordovaContext, pluginPreferences) {
  var options = (cordovaContext.opts && cordovaContext.opts.options) || {};
  var phase = options.phase;
  if (!phase || phase === 'prod') {
    return;
  }

  pluginPreferences.hosts.forEach(function(host) {
    if (host.phaseMode) {
      host.name = phase + '.' + host.name;
    }
  });
}

/**
 * Activate Deep Links for Android application.
 *
 * @param {Object} cordovaContext - cordova context object
 * @param {Object} pluginPreferences - plugin preferences from the config.xml file. Basically, content from <universal-links> tag.
 */
function activateUniversalLinksInAndroid(cordovaContext, pluginPreferences) {
  // inject preferenes into AndroidManifest.xml
  androidManifestWriter.writePreferences(cordovaContext, pluginPreferences);

  // generate html file with the <link> tags that you should inject on the website.
  androidWebHook.generate(cordovaContext, pluginPreferences);
}

/**
 * Activate Universal Links for iOS application.
 *
 * @param {Object} cordovaContext - cordova context object
 * @param {Object} pluginPreferences - plugin preferences from the config.xml file. Basically, content from <universal-links> tag.
 */
function activateUniversalLinksInIos(cordovaContext, pluginPreferences) {
  console.log('afterPrepareHook activateUniversalLinksInIos');
  // modify xcode project preferences
  iosProjectPreferences.enableAssociativeDomainsCapability(cordovaContext);

  // generate entitlements file
  iosProjectEntitlements.generateAssociatedDomainsEntitlements(cordovaContext, pluginPreferences);

  // generate apple-site-association-file
  iosAppSiteAssociationFile.generate(cordovaContext, pluginPreferences);
}
