import { ChangeDetectorRef, Component, OnDestroy, ViewChild } from '@angular/core';
import { I18NService, Locale, LOCALES } from '../state/i18n.service';
import { MatDialog } from '@angular/material/dialog';
import { HelpComponent } from '../help/help.component';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { ZsMapStateService } from '../state/state.service';
import { ZsMapDisplayMode } from '../state/interfaces';
import { Observable, Subject } from 'rxjs';
import { map, takeUntil } from 'rxjs/operators';
import { ConfirmationDialogComponent } from '../confirmation-dialog/confirmation-dialog.component';
import { SessionService } from '../session/session.service';
import { ImportDialogComponent } from '../import-dialog/import-dialog.component';
import { ExportDialogComponent } from '../export-dialog/export-dialog.component';
import { MatMenuTrigger } from '@angular/material/menu';
import { ZsMapBaseDrawElement } from '../map-renderer/elements/base/base-draw-element';
import { DatePipe } from '@angular/common';
import { mapProtocolEntry, ProtocolEntry } from '../helper/mapProtocolEntry';
import { ProtocolTableComponent } from '../protocol-table/protocol-table.component';

@Component({
  selector: 'app-toolbar',
  templateUrl: './toolbar.component.html',
  styleUrls: ['./toolbar.component.css'],
})
export class ToolbarComponent implements OnDestroy {
  @ViewChild(MatMenuTrigger) menu!: MatMenuTrigger;

  static ONBOARDING_VERSION = '1.0';

  historyMode: Observable<boolean>;
  exportEnabled = true;
  downloadData: SafeUrl | null = null;
  locales: Locale[] = LOCALES;
  downloadTime?: string = undefined;
  downloadCSVData?: SafeUrl = undefined;
  protocolEntries: ProtocolEntry[] = [];
  private _ngUnsubscribe = new Subject<void>();

  constructor(
    public i18n: I18NService,
    private cdr: ChangeDetectorRef,
    public dialog: MatDialog,
    private sanitizer: DomSanitizer,
    public zsMapStateService: ZsMapStateService,
    public session: SessionService,
    private datePipe: DatePipe,
  ) {
    this.historyMode = this.zsMapStateService.observeDisplayState().pipe(
      map((displayState) => displayState.displayMode === ZsMapDisplayMode.HISTORY),
      takeUntil(this._ngUnsubscribe),
    );

    this.zsMapStateService
      .observeDisplayState()
      .pipe(takeUntil(this._ngUnsubscribe))
      .subscribe((mode) => {
        window.history.pushState(null, '', '?mode=' + mode.displayMode);
      });

    if (this.isInitialLaunch()) {
      this.dialog.open(HelpComponent, {
        data: true,
      });
    }

    this.zsMapStateService
      .observeDrawElements()
      .pipe(takeUntil(this._ngUnsubscribe))
      .subscribe((elements: ZsMapBaseDrawElement[]) => {
        this.protocolEntries = mapProtocolEntry(
          elements,
          this.datePipe,
          this.i18n,
          this.session.getLocale() === undefined ? 'de' : this.session.getLocale(),
        );
      });
  }

  ngOnDestroy(): void {
    this._ngUnsubscribe.next();
    this._ngUnsubscribe.complete();
  }

  isInitialLaunch(): boolean {
    const currentOnboardingVersion = localStorage.getItem('onboardingVersion');
    if (currentOnboardingVersion !== ToolbarComponent.ONBOARDING_VERSION) {
      localStorage.setItem('onboardingVersion', ToolbarComponent.ONBOARDING_VERSION);
      return true;
    }
    return false;
  }

  exportSession(): void {
    this.dialog.open(ExportDialogComponent);
  }

  toggleHistory(): void {
    this.zsMapStateService.toggleDisplayMode();
  }

  help(): void {
    this.dialog.open(HelpComponent, { data: false });
  }

  importData(): void {
    const dialogRef = this.dialog.open(ImportDialogComponent, {
      maxWidth: '80vw',
      maxHeight: '80vh',
    });
    dialogRef.afterClosed().subscribe((result) => {
      if (result && result.value) {
        this.dialog
          .open(ConfirmationDialogComponent, {
            data: result.replace ? this.i18n.get('confirmImportDrawing') : this.i18n.get('confirmImportDrawingNoReplace'),
          })
          .afterClosed()
          .subscribe((confirmed) => {
            if (confirmed) {
              this.zsMapStateService.setMapState(JSON.parse(result.value));
            }
          });
      }
    });
  }

  getDownloadFileName() {
    return 'zskarte_' + new Date().toISOString() + '.geojson';
  }

  download(): void {
    this.downloadData = this.sanitizer.bypassSecurityTrustUrl(this.zsMapStateService.exportMap());
  }

  protocolTable(): void {
    this.dialog.open(ProtocolTableComponent, { data: false });
  }

  getDownloadFileNameCSV() {
    if (this.downloadTime == undefined) {
      this.downloadTime = new Date().toISOString();
    }
    return 'zskarte_' + this.downloadTime + '.csv';
  }

  downloadCSV(): void {
    const lines: string[] = new Array<string>();

    // header
    const row: string[] = new Array<string>();
    row.push(this.i18n.get('csvID'));
    row.push(this.i18n.get('csvDate'));
    row.push(this.i18n.get('csvGroup'));
    row.push(this.i18n.get('csvSignatur'));
    row.push(this.i18n.get('csvLocation'));
    row.push(this.i18n.get('csvSize'));
    row.push(this.i18n.get('csvLabel'));
    row.push(this.i18n.get('csvDescription'));
    lines.push('"' + row.join('";"') + '"');

    // entry
    this.protocolEntries.forEach((protocolEntry) => {
      const entryRow = new Array<string>();
      entryRow.push(protocolEntry.id);
      entryRow.push(protocolEntry.date === undefined ? '' : protocolEntry.date);
      entryRow.push(protocolEntry.group);
      entryRow.push(protocolEntry.sign);
      entryRow.push(protocolEntry.location);
      entryRow.push(protocolEntry.size);
      entryRow.push(protocolEntry.label);
      entryRow.push(protocolEntry.description);
      for (let i = 0, l = entryRow.length; i < l; i++) {
        entryRow[i] = entryRow[i] ? entryRow[i].replace(/"/g, '""') : '';
      }
      lines.push('"' + entryRow.join('";"') + '"');
    });

    this.downloadCSVData = this.sanitizer.bypassSecurityTrustUrl(
      'data:text/csv;charset=UTF-8,' + encodeURIComponent('\ufeff' + lines.join('\r\n')),
    );
  }

  print(): void {
    this.menu.closeMenu();
    setTimeout(() => {
      window.print();
    }, 0);
  }

  todo(): void {
    console.error('todo');
  }

  setLocale(locale: Locale) {
    this.session.setLocale(locale);
  }

  toggleHistoryIfButton(event: MouseEvent) {
    const element = event.target as HTMLElement;
    if (element.id === 'historyButton') {
      this.toggleHistory();
    }
    event.stopPropagation();
  }
}
