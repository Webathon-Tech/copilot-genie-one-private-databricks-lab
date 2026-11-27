"""Export the Word guide to PDF with an up-to-date table of contents.

Run with LibreOffice's bundled Python (it includes the UNO bridge), from the repository root:

    "C:\\Program Files\\LibreOffice\\program\\python.exe" tools/export-pdf.py

It starts LibreOffice headless, opens docs/Copilot-Genie-One-Private-Integration-Guide.docx, refreshes every index
(so the contents page shows page numbers), and writes the .pdf next to it with bookmarks and working links.
"""
import os
import subprocess
import sys
import time

import uno
from com.sun.star.beans import PropertyValue

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SRC = os.path.join(ROOT, 'docs', 'Copilot-Genie-One-Private-Integration-Guide.docx')
DST = os.path.splitext(SRC)[0] + '.pdf'
SOFFICE = os.path.join(os.path.dirname(sys.executable), 'soffice.exe' if os.name == 'nt' else 'soffice')
PIPE = 'genie_pdf_export'


def prop(name, value):
    p = PropertyValue()
    p.Name, p.Value = name, value
    return p


office = subprocess.Popen([SOFFICE, '--headless', '--invisible', '--norestore', '--nologo',
                           f'--accept=pipe,name={PIPE};urp;StarOffice.ComponentContext'])
try:
    local = uno.getComponentContext()
    resolver = local.ServiceManager.createInstanceWithContext('com.sun.star.bridge.UnoUrlResolver', local)
    ctx = None
    for _ in range(60):
        try:
            ctx = resolver.resolve(f'uno:pipe,name={PIPE};urp;StarOffice.ComponentContext')
            break
        except Exception:
            time.sleep(0.5)
    if ctx is None:
        raise SystemExit('LibreOffice did not start')
    desktop = ctx.ServiceManager.createInstanceWithContext('com.sun.star.frame.Desktop', ctx)
    doc = desktop.loadComponentFromURL(uno.systemPathToFileUrl(SRC), '_blank', 0, (prop('Hidden', True),))
    indexes = doc.getDocumentIndexes()
    for i in range(indexes.getCount()):
        indexes.getByIndex(i).update()
    doc.refresh()
    for i in range(indexes.getCount()):  # second pass: page numbers settle after the first update
        indexes.getByIndex(i).update()
    filter_data = uno.Any('[]com.sun.star.beans.PropertyValue', (
        prop('ExportBookmarks', True),
        prop('ExportLinksRelativeFsys', False),
        prop('UseTaggedPDF', True),
        prop('Quality', 95),
        prop('ReduceImageResolution', False),
    ))
    doc.storeToURL(uno.systemPathToFileUrl(DST), (prop('FilterName', 'writer_pdf_Export'), prop('FilterData', filter_data)))
    doc.close(True)
    print('wrote', DST)
finally:
    try:
        desktop.terminate()
    except Exception:
        pass
    office.wait(timeout=60)
