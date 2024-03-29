// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: light-gray; icon-glyph: notes-medical;
const VERSION = '1.1.0';

const DEBUG = false;
const log = (args) => {

    if (DEBUG) {
        console.log(args);
    }
};

const ARGUMENTS = {
    widgetTitle: 'Covid-19',
    sourceUrl: 'http://ncov.kdca.go.kr',
    // desired interval in minutes to refresh the
    // widget. This will only tell IOS that it's
    // ready for a refresh, whether it actually 
    // refreshes is up to IOS
    refreshInterval: 180 //mins
};
Object.freeze(ARGUMENTS);

const MENU_PROPERTY = {
    rowDismiss: true,
    rowHeight: 50,
    subtitleColor: Color.lightGray()
};
Object.freeze(MENU_PROPERTY);

const CommonUtil = {
    isNumber: (value) => {
        let isValid = false;
    
        if (typeof value === 'number') {
            isValid = true;
        } else if (typeof value === 'string') {
            isValid = /^\d{1,}$/.test(value);
        }
    
        return isValid;
    },
    compareVersion: (version1 = '', version2 = '') => {
        version1 = version1.replace(/\.|\s|\r\n|\r|\n/gi, '');
        version2 = version2.replace(/\.|\s|\r\n|\r|\n/gi, '');

        if (!CommonUtil.isNumber(version1) || !CommonUtil.isNumber(version2)) {
            return false;
        }

        return version1 < version2;
    }
};

const Covid19Client = {
    //----------------------------------------------
    initialize: () => {
        try {
            this.USES_ICLOUD = module.filename.includes('Documents/iCloud~');
            this.fm = this.USES_ICLOUD ? FileManager.iCloud() : FileManager.local();
            this.root = this.fm.joinPath(this.fm.documentsDirectory(), '/cache/covid19');
            this.fm.createDirectory(this.root, true);
        } catch (e) {
            log(e.message);
        }
    },
    //----------------------------------------------
    getCovid19Info: async () => {
        try {
            const webView = new WebView();
            await webView.loadURL(ARGUMENTS.sourceUrl);
            
            return await webView.evaluateJavaScript(`
                const CONTAINER = 'div.mainlive_container div.liveboard_layout';
                let renewalDate = document.querySelector(\`\${CONTAINER} div.occurrenceStatus span.livedate\`)?.innerText || '';
                let domesticCount = document.querySelector(\`\${CONTAINER} div.occur_graph > table.ds_table tbody > tr:first-of-type > td:nth-of-type(3) > span\`)?.innerText ?? '0';
                let vaccineRateTitle = document.querySelector(\`\${CONTAINER} ul.today_info_list li:first-of-type .inner li:last-of-type\`)?.innerText || '';
                let vaccineRate = document.querySelector(\`\${CONTAINER} ul.today_info_list li:last-of-type .inner li:last-of-type span:last-of-type\`)?.innerText ?? '0%';
            
                completion({
                    renewalDate: renewalDate.match(/\\d{1,2}\\.\\d{1,2}\\.\\s00시 기준/g).pop(),
                    count: {
                        domestic: domesticCount
                    },
                    vaccine: {
                        title: vaccineRateTitle.replace(/\\n/g, ''),
                        rate: vaccineRate.match(/(.*)\\*\\*$/i).pop()
                    }
                });
            `, true);
        } catch (e) {
            log(e.message);
        }
    },
    clearCache: async () => {
        this.fm.remove(this.root);
    },
    updateModule: async () => {
        try {
            const latestVersion = await new Request('https://raw.githubusercontent.com/clauzewitz/scriptable-covid19-widgets/main/version').loadString();

            if (CommonUtil.compareVersion(VERSION, latestVersion)) {
                const code = await new Request('https://raw.githubusercontent.com/clauzewitz/scriptable-covid19-widgets/main/covid19_kr.js').loadString();
                this.fm.writeString(this.fm.joinPath(this.fm.documentsDirectory(), `${Script.name()}.js`), code);
                await Covid19Client.presentAlert(`Update to version ${latestVersion}\nPlease launch the app again.`);
            } else {
                await Covid19Client.presentAlert(`version ${VERSION} is currently the newest version available.`);
            }
        } catch (e) {
            log(e.message);
        }
    },
    //----------------------------------------------
    presentAlert: async (prompt = '', items = ['OK'], asSheet = false) => {
        try {
            const alert = new Alert();
            alert.message = prompt;
    
            items.forEach(item => {
                alert.addAction(item);
            });
    
            return asSheet ? await alert.presentSheet() : await alert.presentAlert();
        } catch (e) {
            log(e.message);
        }
    }
};

const createWidget = async (data) => {
    const padding = 10;
    const count = data.count.domestic.replace(',', '');

    const widget = new ListWidget();
    widget.refreshAfterDate = new Date((Date.now() + (1000 * 60 * ARGUMENTS.refreshInterval)));
    widget.url = ARGUMENTS.sourceUrl;
    widget.setPadding(padding, padding, padding, padding);
    widget.backgroundColor = new Color(getLevelColor(count));
    widget.addSpacer();
    
    const titleRow = widget.addStack();
    const titleStack = titleRow.addStack();
    titleStack.layoutHorizontally();
    titleStack.centerAlignContent();
    titleStack.addSpacer();
    
    const titleFontSize = Device.isPhone() ? 17 : 20;
    addSymbol(titleStack, 'burn', titleFontSize);
    titleStack.addSpacer(2);

    addText(titleStack, ARGUMENTS.widgetTitle, 'center', titleFontSize, true);
    titleStack.addSpacer();
    
    addText(widget, data.count.domestic, 'center', getCountSize(count), true);
    addText(widget, data.renewalDate, 'right', 10);
    
    widget.addSpacer();
    
    addText(widget, `${data.vaccine.title}: ${data.vaccine.rate}`, 'right', 10);
    
    return widget;
};

const addSymbol = (container, name, size) => {
    const sfIcon = SFSymbol.named(name);
    const icon = container.addImage(sfIcon.image);
    icon.tintColor = Color.white();
    icon.imageSize = new Size(size,size);

    return icon;
};

const addText = (container, text, align = 'center', size = 12, isBold = false) => {
    const txt = container.addText(text);
    txt[`${align}AlignText`]();
    txt.font = isBold ? Font.boldSystemFont(size) : Font.systemFont(size);
    txt.textColor = Color.white();
};

const getCountSize = (count = '100') => {
    let countLength = count.length < 3 ? 0 : (count.length - 3);

    return Device.isPhone() ? 55 - (countLength * 9) : 55 - (countLength * 7);
};
const getLevelColor = (count = 0) => {
    
    if (count > 10000) {
        return '#DA3539';
    } else if (count > 4000) {
        return '#F6C832';
    } else if (count > 1000) {
        return '#05B26D';
    } else {
        return '#2153B7';
    }
};

const MENU_ROWS = {
    title: {
        isHeader: true,
        title: `${ARGUMENTS.widgetTitle} Widget`,
        subtitle: `version: ${VERSION}`,
        onSelect: undefined
    },
    checkUpdate: {
        isHeader: false,
        title: 'Check for Updates',
        subtitle: 'Check for updates to the latest version.',
        onSelect: async () => {
            Covid19Client.updateModule();
        }
    },
    preview: {
        isHeader: false,
        title: 'Preview Widget',
        subtitle: 'Provides a preview for testing.',
        onSelect: async () => {
            const widget = await createWidget(covideInfo);
            
            await widget[`presentSmall`]();
        }
    },
    clearCache: {
        isHeader: false,
        title: 'Clear cache',
        subtitle: 'Clear all caches.',
        onSelect: async () => {
            await Covid19Client.clearCache();
        }
    }
};

Covid19Client.initialize();

const covideInfo = await Covid19Client.getCovid19Info();

if (config.runsInWidget) {
    const widget = await createWidget(covideInfo);
    Script.setWidget(widget);
} else {
    const menu = new UITable();
    menu.showSeparators = true;

    Object.values(MENU_ROWS).forEach((rowInfo) => {
        const row = new UITableRow();
        row.isHeader = rowInfo.isHeader;
        row.dismissOnSelect = MENU_PROPERTY.rowDismiss;
        row.height = MENU_PROPERTY.rowHeight;
        const cell = row.addText(rowInfo.title, rowInfo.subtitle);
        cell.subtitleColor = MENU_PROPERTY.subtitleColor;
        row.onSelect = rowInfo.onSelect;
        menu.addRow(row);
    });

    await menu.present(false);
}

Script.complete();
