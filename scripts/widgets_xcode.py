"""Ajoute la cible « NidooWidgets » (extension WidgetKit) au projet Xcode de Capacitor, et les fichiers du pont
dans la cible de l'appli. Repart du projet d'avant les widgets (commit 3d6be70) : on peut le relancer quand
on ajoute un fichier Swift dans ios/App/NidooWidgets ou ios/App/Partage.

    python3 scripts/widgets_xcode.py
"""
import hashlib, os, re, subprocess

RACINE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
PROJET = os.path.join(RACINE, 'ios', 'App', 'App.xcodeproj', 'project.pbxproj')
BASE = '3d6be70'
CIBLE = 'NidooWidgets'
IDENTIFIANT = 'com.getupworkspace.nidoo.widgets'


def ident(nom):
    """Un identifiant Xcode (24 chiffres hexadécimaux), toujours le même pour le même nom."""
    return 'A1D0' + hashlib.md5(nom.encode()).hexdigest()[:20].upper()


def fichiers(dossier, ext):
    d = os.path.join(RACINE, 'ios', 'App', dossier)
    return sorted(f for f in os.listdir(d) if f.endswith(ext))


def apres(texte, repere, ajout):
    assert repere in texte, repere
    return texte.replace(repere, repere + ajout, 1)


def avant(texte, repere, ajout):
    assert repere in texte, repere
    return texte.replace(repere, ajout + repere, 1)


def main():
    p = subprocess.run(['git', 'show', f'{BASE}:ios/App/App.xcodeproj/project.pbxproj'], cwd=RACINE, capture_output=True, text=True, check=True).stdout
    assert CIBLE not in p

    swift_widgets = fichiers('NidooWidgets', '.swift')
    swift_partage = fichiers('Partage', '.swift')
    swift_appli = ['NidooPlugin.swift', 'NidooViewController.swift']

    ref = lambda chemin: ident('ref:' + chemin)
    T = ident('cible')            # la cible
    PRODUIT = ident('produit')
    G_WIDGETS, G_PARTAGE = ident('groupe:widgets'), ident('groupe:partage')
    PH_SOURCES, PH_CADRES, PH_RESSOURCES, PH_EMBARQUE = ident('phase:sources'), ident('phase:cadres'), ident('phase:ressources'), ident('phase:embarque')
    PROXY, DEPENDANCE = ident('proxy'), ident('dependance')
    CONF_LISTE, CONF_DEBUG, CONF_RELEASE = ident('conf:liste'), ident('conf:debug'), ident('conf:release')
    PROJET_ID, CIBLE_APPLI = '504EC2FC1FED79650016851F', '504EC3031FED79650016851F'

    # ── les fichiers ──
    refs, builds = [], []
    src_appli, src_widgets = [], []
    for f in swift_appli:
        refs.append(f'\t\t{ref("App/" + f)} /* {f} */ = {{isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = {f}; sourceTree = "<group>"; }};')
        b = ident('build:appli:' + f)
        builds.append(f'\t\t{b} /* {f} in Sources */ = {{isa = PBXBuildFile; fileRef = {ref("App/" + f)} /* {f} */; }};')
        src_appli.append(f'\t\t\t\t{b} /* {f} in Sources */,')
    for f in swift_partage:
        refs.append(f'\t\t{ref("Partage/" + f)} /* {f} */ = {{isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = {f}; sourceTree = "<group>"; }};')
        for cote, liste in (('appli', src_appli), ('widgets', src_widgets)):
            b = ident(f'build:{cote}:Partage/' + f)
            builds.append(f'\t\t{b} /* {f} in Sources */ = {{isa = PBXBuildFile; fileRef = {ref("Partage/" + f)} /* {f} */; }};')
            liste.append(f'\t\t\t\t{b} /* {f} in Sources */,')
    for f in swift_widgets:
        refs.append(f'\t\t{ref("NidooWidgets/" + f)} /* {f} */ = {{isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = {f}; sourceTree = "<group>"; }};')
        b = ident('build:widgets:' + f)
        builds.append(f'\t\t{b} /* {f} in Sources */ = {{isa = PBXBuildFile; fileRef = {ref("NidooWidgets/" + f)} /* {f} */; }};')
        src_widgets.append(f'\t\t\t\t{b} /* {f} in Sources */,')
    R_IMAGES, R_INFO, R_DROITS, R_DROITS_APPLI = ref('NidooWidgets/Assets.xcassets'), ref('NidooWidgets/Info.plist'), ref('NidooWidgets/NidooWidgets.entitlements'), ref('App/App.entitlements')
    B_IMAGES, B_EMBARQUE = ident('build:widgets:Assets.xcassets'), ident('build:embarque')
    refs += [
        f'\t\t{R_IMAGES} /* Assets.xcassets */ = {{isa = PBXFileReference; lastKnownFileType = folder.assetcatalog; path = Assets.xcassets; sourceTree = "<group>"; }};',
        f'\t\t{R_INFO} /* Info.plist */ = {{isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = Info.plist; sourceTree = "<group>"; }};',
        f'\t\t{R_DROITS} /* NidooWidgets.entitlements */ = {{isa = PBXFileReference; lastKnownFileType = text.plist.entitlements; path = NidooWidgets.entitlements; sourceTree = "<group>"; }};',
        f'\t\t{R_DROITS_APPLI} /* App.entitlements */ = {{isa = PBXFileReference; lastKnownFileType = text.plist.entitlements; path = App.entitlements; sourceTree = "<group>"; }};',
        f'\t\t{PRODUIT} /* {CIBLE}.appex */ = {{isa = PBXFileReference; explicitFileType = "wrapper.app-extension"; includeInIndex = 0; path = {CIBLE}.appex; sourceTree = BUILT_PRODUCTS_DIR; }};',
    ]
    builds += [
        f'\t\t{B_IMAGES} /* Assets.xcassets in Resources */ = {{isa = PBXBuildFile; fileRef = {R_IMAGES} /* Assets.xcassets */; }};',
        f'\t\t{B_EMBARQUE} /* {CIBLE}.appex in Embed Foundation Extensions */ = {{isa = PBXBuildFile; fileRef = {PRODUIT} /* {CIBLE}.appex */; settings = {{ATTRIBUTES = (RemoveHeadersOnCopy, ); }}; }};',
    ]
    p = avant(p, '/* End PBXBuildFile section */', '\n'.join(builds) + '\n')
    p = avant(p, '/* End PBXFileReference section */', '\n'.join(refs) + '\n')

    # ── l'extension est embarquée dans l'appli, qui en dépend ──
    p = avant(p, '/* Begin PBXFileReference section */', f'''/* Begin PBXContainerItemProxy section */
\t\t{PROXY} /* PBXContainerItemProxy */ = {{
\t\t\tisa = PBXContainerItemProxy;
\t\t\tcontainerPortal = {PROJET_ID} /* Project object */;
\t\t\tproxyType = 1;
\t\t\tremoteGlobalIDString = {T};
\t\t\tremoteInfo = {CIBLE};
\t\t}};
/* End PBXContainerItemProxy section */

/* Begin PBXCopyFilesBuildPhase section */
\t\t{PH_EMBARQUE} /* Embed Foundation Extensions */ = {{
\t\t\tisa = PBXCopyFilesBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tdstPath = "";
\t\t\tdstSubfolderSpec = 13;
\t\t\tfiles = (
\t\t\t\t{B_EMBARQUE} /* {CIBLE}.appex in Embed Foundation Extensions */,
\t\t\t);
\t\t\tname = "Embed Foundation Extensions";
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t}};
/* End PBXCopyFilesBuildPhase section */

''')
    p = avant(p, '/* Begin PBXVariantGroup section */', f'''/* Begin PBXTargetDependency section */
\t\t{DEPENDANCE} /* PBXTargetDependency */ = {{
\t\t\tisa = PBXTargetDependency;
\t\t\ttarget = {T} /* {CIBLE} */;
\t\t\ttargetProxy = {PROXY} /* PBXContainerItemProxy */;
\t\t}};
/* End PBXTargetDependency section */

''')
    p = apres(p, '''/* Begin PBXFrameworksBuildPhase section */
''', f'''\t\t{PH_CADRES} /* Frameworks */ = {{
\t\t\tisa = PBXFrameworksBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tfiles = (
\t\t\t);
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t}};
''')

    # ── les groupes ──
    p = apres(p, '''\t\t\t\t504EC3051FED79650016851F /* Products */,
''', f'''\t\t\t\t{G_PARTAGE} /* Partage */,
\t\t\t\t{G_WIDGETS} /* {CIBLE} */,
''')
    p = apres(p, '''\t\t\t\t504EC3041FED79650016851F /* App.app */,
''', f'''\t\t\t\t{PRODUIT} /* {CIBLE}.appex */,
''')
    p = apres(p, '''\t\t\t\t50B271D01FEDC1A000F3C39B /* public */,
''', ''.join(f'\t\t\t\t{ref("App/" + f)} /* {f} */,\n' for f in swift_appli) + f'\t\t\t\t{R_DROITS_APPLI} /* App.entitlements */,\n')
    enfants_widgets = ''.join(f'\t\t\t\t{ref("NidooWidgets/" + f)} /* {f} */,\n' for f in swift_widgets)
    enfants_partage = ''.join(f'\t\t\t\t{ref("Partage/" + f)} /* {f} */,\n' for f in swift_partage)
    p = avant(p, '/* End PBXGroup section */', f'''\t\t{G_WIDGETS} /* {CIBLE} */ = {{
\t\t\tisa = PBXGroup;
\t\t\tchildren = (
{enfants_widgets}\t\t\t\t{R_IMAGES} /* Assets.xcassets */,
\t\t\t\t{R_INFO} /* Info.plist */,
\t\t\t\t{R_DROITS} /* NidooWidgets.entitlements */,
\t\t\t);
\t\t\tpath = {CIBLE};
\t\t\tsourceTree = "<group>";
\t\t}};
\t\t{G_PARTAGE} /* Partage */ = {{
\t\t\tisa = PBXGroup;
\t\t\tchildren = (
{enfants_partage}\t\t\t);
\t\t\tpath = Partage;
\t\t\tsourceTree = "<group>";
\t\t}};
''')

    # ── les cibles ──
    p = apres(p, '''\t\t\t\t504EC3021FED79650016851F /* Resources */,
''', f'''\t\t\t\t{PH_EMBARQUE} /* Embed Foundation Extensions */,
''')
    p = p.replace('''\t\t\tdependencies = (
\t\t\t);
\t\t\tname = App;''', f'''\t\t\tdependencies = (
\t\t\t\t{DEPENDANCE} /* PBXTargetDependency */,
\t\t\t);
\t\t\tname = App;''', 1)
    assert DEPENDANCE in p
    p = avant(p, '/* End PBXNativeTarget section */', f'''\t\t{T} /* {CIBLE} */ = {{
\t\t\tisa = PBXNativeTarget;
\t\t\tbuildConfigurationList = {CONF_LISTE} /* Build configuration list for PBXNativeTarget "{CIBLE}" */;
\t\t\tbuildPhases = (
\t\t\t\t{PH_SOURCES} /* Sources */,
\t\t\t\t{PH_CADRES} /* Frameworks */,
\t\t\t\t{PH_RESSOURCES} /* Resources */,
\t\t\t);
\t\t\tbuildRules = (
\t\t\t);
\t\t\tdependencies = (
\t\t\t);
\t\t\tname = {CIBLE};
\t\t\tproductName = {CIBLE};
\t\t\tproductReference = {PRODUIT} /* {CIBLE}.appex */;
\t\t\tproductType = "com.apple.product-type.app-extension";
\t\t}};
''')
    p = apres(p, '''\t\t\t\t\t\tProvisioningStyle = Automatic;
\t\t\t\t\t};
''', f'''\t\t\t\t\t{T} = {{
\t\t\t\t\t\tCreatedOnToolsVersion = 16.0;
\t\t\t\t\t\tProvisioningStyle = Automatic;
\t\t\t\t\t}};
''')
    p = apres(p, '''\t\t\tknownRegions = (
\t\t\t\ten,
''', '\t\t\t\tfr,\n')
    p = apres(p, '''\t\t\ttargets = (
\t\t\t\t504EC3031FED79650016851F /* App */,
''', f'''\t\t\t\t{T} /* {CIBLE} */,
''')

    # ── les phases ──
    p = avant(p, '/* End PBXResourcesBuildPhase section */', f'''\t\t{PH_RESSOURCES} /* Resources */ = {{
\t\t\tisa = PBXResourcesBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tfiles = (
\t\t\t\t{B_IMAGES} /* Assets.xcassets in Resources */,
\t\t\t);
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t}};
''')
    p = apres(p, '''\t\t\t\t9582B6832FE993A70072D4E8 /* SceneDelegate.swift in Sources */,
''', '\n'.join(src_appli) + '\n')
    p = avant(p, '/* End PBXSourcesBuildPhase section */', f'''\t\t{PH_SOURCES} /* Sources */ = {{
\t\t\tisa = PBXSourcesBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tfiles = (
''' + '\n'.join(src_widgets) + f'''
\t\t\t);
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t}};
''')

    # ── les réglages ──
    n = p.count('\t\t\t\tCURRENT_PROJECT_VERSION = 1;\n\t\t\t\tINFOPLIST_FILE = App/Info.plist;')
    assert n == 2, n
    p = p.replace('\t\t\t\tCURRENT_PROJECT_VERSION = 1;\n\t\t\t\tINFOPLIST_FILE = App/Info.plist;',
                  '\t\t\t\tCODE_SIGN_ENTITLEMENTS = App/App.entitlements;\n\t\t\t\tCURRENT_PROJECT_VERSION = 1;\n\t\t\t\tINFOPLIST_FILE = App/Info.plist;')

    def conf(idc, nom, debug):
        return f'''\t\t{idc} /* {nom} */ = {{
\t\t\tisa = XCBuildConfiguration;
\t\t\tbuildSettings = {{
\t\t\t\tASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME = AccentColor;
\t\t\t\tASSETCATALOG_COMPILER_WIDGET_BACKGROUND_COLOR_NAME = WidgetBackground;
\t\t\t\tCODE_SIGN_ENTITLEMENTS = {CIBLE}/{CIBLE}.entitlements;
\t\t\t\tCODE_SIGN_STYLE = Automatic;
\t\t\t\tCURRENT_PROJECT_VERSION = 1;
\t\t\t\tGENERATE_INFOPLIST_FILE = NO;
\t\t\t\tINFOPLIST_FILE = {CIBLE}/Info.plist;
\t\t\t\tIPHONEOS_DEPLOYMENT_TARGET = 17.0;
\t\t\t\tLD_RUNPATH_SEARCH_PATHS = (
\t\t\t\t\t"$(inherited)",
\t\t\t\t\t"@executable_path/Frameworks",
\t\t\t\t\t"@executable_path/../../Frameworks",
\t\t\t\t);
\t\t\t\tMARKETING_VERSION = 1.0;
\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = {IDENTIFIANT};
\t\t\t\tPRODUCT_NAME = "$(TARGET_NAME)";
\t\t\t\tSKIP_INSTALL = YES;
{'' if not debug else chr(9) * 4 + 'SWIFT_ACTIVE_COMPILATION_CONDITIONS = DEBUG;' + chr(10)}\t\t\t\tSWIFT_EMIT_LOC_STRINGS = YES;
\t\t\t\tSWIFT_VERSION = 5.0;
\t\t\t\tTARGETED_DEVICE_FAMILY = "1,2";
\t\t\t}};
\t\t\tname = {nom};
\t\t}};
'''
    p = avant(p, '/* End XCBuildConfiguration section */', conf(CONF_DEBUG, 'Debug', True) + conf(CONF_RELEASE, 'Release', False))
    p = avant(p, '/* End XCConfigurationList section */', f'''\t\t{CONF_LISTE} /* Build configuration list for PBXNativeTarget "{CIBLE}" */ = {{
\t\t\tisa = XCConfigurationList;
\t\t\tbuildConfigurations = (
\t\t\t\t{CONF_DEBUG} /* Debug */,
\t\t\t\t{CONF_RELEASE} /* Release */,
\t\t\t);
\t\t\tdefaultConfigurationIsVisible = 0;
\t\t\tdefaultConfigurationName = Release;
\t\t}};
''')

    # tous les identifiants sont uniques, les accolades se referment
    ids = re.findall(r'^\t\t([0-9A-F]{24}) /\*', p, re.M)
    assert len(ids) == len(set(ids)), [i for i in ids if ids.count(i) > 1]
    assert p.count('{') == p.count('}') and p.count('(') == p.count(')')
    open(PROJET, 'w').write(p)
    print(f'{len(swift_widgets)} fichiers Swift dans {CIBLE}, {len(swift_partage)} partagés, {len(swift_appli)} dans App')


if __name__ == '__main__':
    main()
