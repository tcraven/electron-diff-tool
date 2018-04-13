import React, { Component } from 'react';
import fs from 'fs-extra';
import electron from 'electron';
const jsdiff = require('diff');
const escapeHtml = require('escape-html');


const Menu = (props) => {
  return (
    <div className="menu">
      {props.comparisons.map((comparison, comparisonIndex) => {
        return (
          <div key={comparisonIndex} className="menu-comparison">
            {comparison.docA.filename}{' <=> '}{comparison.docB.filename}
          </div>
        );
      })}
    </div>
  );
};


const LineNumbers = (props) => {
  let lineNumbers = [];
  for (let i = 1; i <= props.count; i++) {
    lineNumbers.push(i);
  }
  return (
    <div className="line-numbers">
      <pre className="line-numbers-pre">{lineNumbers.join('\n')}</pre>
    </div>
  );
};


const DocHtml = (props) => {
  return (
    <div
      className="doc-html"
      dangerouslySetInnerHTML={{ __html: props.html }}
    />
  );
};


const Doc = (props) => {
  if (props.doc.error) {
    return (
      <div className="doc">
        <div>{props.doc.error.toString()}</div>
      </div>
    );
  }
  return (
    <div className="doc">
      <div className={`doc-body ${props.className}`}>
        <LineNumbers count={props.doc.lineCount} />
        <DocHtml html={props.doc.changesHtml} />
      </div>
    </div>
  );
};


const Middle = (props) => {
  return (
    <div className="middle"></div>
  );
};


class App extends Component {

  constructor(props) {
    super(props);
    this.state = {
      comparisons: []
    };
    // Used to draw after a render
    this.drawTimer = null;

    this.onScroll = this.onScroll.bind(this);
    this.updateLines = this.updateLines.bind(this);
  }

  componentDidMount() {
    this.load();
  }

  getHtml(text) {
    let lines = text.split('\n');
    return lines.map((line) => {
      let htmlWords = line.split(' ').map((word) => {
        return escapeHtml(word);
      });
      return htmlWords.join('&nbsp;');
    }).join('<br/>');
  }

  async load() {
    let args = electron.remote.process.argv;
    console.log('QQQ', args);
    let filenameA = args[2];
    let filenameB = args[3];
    console.log('QQQ', filenameA, filenameB);

    let comparisons = this.state.comparisons;

    comparisons.push({
      docA: {
        filename: filenameA,
        text: '',
        lines: [],
        lineCount: 0,
        error: null
      },
      docB: {
        filename: filenameB,
        text: '',
        lines: [],
        lineCount: 0,
        error: null
      }
    });

    for (let comparison of comparisons) {
      for (let docName of ['docA', 'docB']) {
        try {
          let filename = comparison[docName].filename;
          // console.log('XXX', filename);
          let text = await fs.readFile(filename, 'utf-8');
          comparison[docName].text = text;
          let lines = text.split('\n');
          comparison[docName].lines = lines;
          comparison[docName].lineCount = lines.length;
          // console.log('XXX', lines.length);
        }
        catch (error) {
          comparison[docName].error = error;
        }
      }

      let diffs = jsdiff.diffLines(comparison.docA.text, comparison.docB.text);
      let prevChange = null;
      let newDiffs = [];

      // Replace consecutive removed then added changes with a modified change
      let wasPrevModified = false;
      let i = 1;
      while (i < diffs.length) {
        // console.log('ZZZ', i, wasPrevModified);
        let prevChange = diffs[i - 1];
        let change = diffs[i];
        let isFinalChange = (i == diffs.length - 1);

        // console.log('ZZZ', i, prevChange, change, isFinalChange);

        if (prevChange.removed && change.added) {
          // console.log('ZZZ', i, 'modified', i - 1, i);
          newDiffs.push({
            modified: true,
            removedChange: prevChange,
            addedChange: change,
            charDiffs: jsdiff.diffWordsWithSpace(prevChange.value, change.value)
          });
          wasPrevModified = true;
          i += 1;
          continue;
        }
        
        if (!wasPrevModified) {
          // console.log('ZZZ', i,  'adding prev change', i - 1);
          newDiffs.push(prevChange);
        }
        if (isFinalChange) {
          // console.log('ZZZ', i, 'adding final change', i);
          newDiffs.push(change);
        }
        i += 1;
        wasPrevModified = false;
      }
      comparison.diffsOriginal = diffs;
      comparison.diffs = newDiffs;

      let chunksA = [];
      let chunksB = [];
      let lineNumberA = 1;
      let lineNumberB = 1;
      let changeIndex = 0;
      for (let change of comparison.diffs) {
        change.lineNumbers = {
          a: { start: lineNumberA },
          b: { start: lineNumberB }
        };

        if (change.modified) {
          chunksA.push(`<div class="doc-modified" data-change="${changeIndex}">`);
          chunksB.push(`<div class="doc-modified" data-change="${changeIndex}">`);
          for (let charChange of change.charDiffs) {
            if (charChange.removed) {
              chunksA.push('<span class="doc-modified-removed">');
              chunksA.push(this.getHtml(charChange.value));
              chunksA.push('</span>');
            }
            else if (charChange.added) {
              chunksB.push('<span class="doc-modified-added">');
              chunksB.push(this.getHtml(charChange.value));
              chunksB.push('</span>');
            }
            else {
              chunksA.push(this.getHtml(charChange.value));
              chunksB.push(this.getHtml(charChange.value));
            }
          }
          chunksA.push('</div>');
          chunksB.push('</div>');

          lineNumberA += change.removedChange.count;
          lineNumberB += change.addedChange.count;
          changeIndex += 1;
        }
        else if (change.removed) {
          chunksA.push(`<div class="doc-removed" data-change="${changeIndex}">`);
          chunksB.push(`<div class="doc-removed" data-change="${changeIndex}">`);

          chunksA.push('<span class="doc-removed-chars">');
          chunksA.push(this.getHtml(change.value));
          chunksA.push('</span>');
          chunksA.push('</div>');
          chunksB.push('</div>');

          lineNumberA += change.count;
          changeIndex += 1;
        }
        else if (change.added) {
          chunksA.push(`<div class="doc-added" data-change="${changeIndex}">`);
          chunksB.push(`<div class="doc-added" data-change="${changeIndex}">`);

          chunksB.push('<span class="doc-added-chars">');
          chunksB.push(this.getHtml(change.value));
          chunksB.push('</span>');
          chunksA.push('</div>');
          chunksB.push('</div>');

          lineNumberB += change.count;
          changeIndex += 1;
        }
        else {
          chunksA.push(`<div class="doc-same" data-change="${changeIndex}">`);
          chunksB.push(`<div class="doc-same" data-change="${changeIndex}">`);
          chunksA.push(this.getHtml(change.value));
          chunksB.push(this.getHtml(change.value));
          chunksA.push('</div>');
          chunksB.push('</div>');

          lineNumberA += change.count;
          lineNumberB += change.count;
        }

        change.lineNumbers.a.end = lineNumberA;
        change.lineNumbers.b.end = lineNumberB; 
      }

      comparison.docA.changesHtml = chunksA.join('');
      comparison.docB.changesHtml = chunksB.join('');
    
      comparison.changes = comparison.diffs;
    }

    console.log('XXX', comparisons);

    this.setState({
      comparisons: comparisons
    });
  }

  render() {
    console.log('XXX render');
    clearTimeout(this.drawTimer);
    this.drawTimer = setTimeout(() => { this.renderOverlays(); }, 10);

    let comparison = this.state.comparisons[0];
    if (!comparison) {
      return null;
    }
    return (
      <div className="app">
        <div className="header">
          <div className="filename-a">{comparison.docA.filename}</div>
          <div className="filename-b">{comparison.docB.filename}</div>
        </div>
        <div className="docs">
          <Doc className="docA" doc={comparison.docA} />
          <Middle />
          <Doc className="docB" doc={comparison.docB} />
        </div>
      </div>
    );
  }

  renderOverlays() {
    console.log('XXX renderOverlays');
    // var matches = document.querySelectorAll("iframe[data-change]");

    this.scrollInfo = {};
    this.docBodyElements = {};
    let docBodyElements = document.querySelectorAll('.doc-body');
    for (let el of docBodyElements) {
      el.removeEventListener('scroll', this.onScroll);
      el.addEventListener('scroll', this.onScroll);
      this.docBodyElements[el.className] = el;
      this.scrollInfo[el.className] = {
        top: el.scrollTop,
        left: el.scrollLeft
      };
    }

    this.changePositions = [];
    this.changes = this.state.comparisons[0].changes;
    // Change elements are already in the correct order so their
    // indexes correspond to the changes indexes
    let changeElsA = document.querySelectorAll('.docA div[data-change]');
    let changeElsB = document.querySelectorAll('.docB div[data-change]');
    for (let i = 0; i < changeElsA.length; i++) {
      let heightA = changeElsA[i].offsetHeight;
      let heightB = changeElsB[i].offsetHeight;
      let changePos = {
        index: i,
        a: {
          top: changeElsA[i].offsetTop,
          bottom: changeElsA[i].offsetTop + heightA,
          height: heightA
        },
        b: {
          top: changeElsB[i].offsetTop,
          bottom: changeElsB[i].offsetTop + heightB,
          height: heightB
        },
        // TO DO: How to properly handle zero height changes?
        heightRatio: (heightA > 0) ? (heightB / heightA) : 1000
      };
      this.changePositions.push(changePos);
    }

    console.log('changePositions', this.changePositions);

    this.middleEl = document.querySelector('.middle');

    this.isRepaintRequired = true;
    window.requestAnimationFrame(this.updateLines);
  }

  onScroll(e) {    
    let className = e.target.className;
    let scrollTop = e.target.scrollTop;
    let scrollLeft = e.target.scrollLeft;

    // If this scroll event wasn't caused by the user,
    // do nothing
    if (this.scrollClassName && this.scrollClassName != className) {
      return;
    }
    this.scrollClassName = className;
    clearTimeout(this.scrollTimer);
    this.scrollTimer = setTimeout(() => {
      this.scrollClassName = null;
    }, 100);
    
    this.scrollInfo[className] = {
      top: scrollTop,
      left: scrollLeft
    };

    // Calculate the scrollTop and scrollLeft of the other
    // document and apply it
    let docKey = (className == 'doc-body docA') ? 'a' : 'b';
    let otherDocKey = (className == 'doc-body docA') ? 'b' : 'a';
    let otherClassName = (className == 'doc-body docA') ?
      'doc-body docB' : 'doc-body docA';

    let otherScrollLeft = scrollLeft;
    let otherScrollTop = scrollTop;

    // Find change closest to baseline and adjust scroll of other
    // doc so that the centers line up
    let otherBodyEl = this.docBodyElements[otherClassName];
    // Choose baseline y position as the center of the window
    let baselineY = scrollTop + 0.5 * otherBodyEl.offsetHeight;

    // Find the current change that is on the baseline
    // TO DO: Use a more efficient method
    let baselineChangePos = null;
    for (let changePos of this.changePositions) {
      if (
        changePos[docKey].top < baselineY &&
        baselineY <= changePos[docKey].bottom
      ) {
        baselineChangePos = changePos;
        break;
      }
    }

    let heightRatio = (docKey == 'a') ? baselineChangePos.heightRatio : 1 / baselineChangePos.heightRatio;
    otherScrollTop = 
      baselineChangePos[otherDocKey].top
      + (baselineY - baselineChangePos[docKey].top) * heightRatio
      - 0.5 * otherBodyEl.offsetHeight;

    otherScrollTop = Math.max(0, otherScrollTop);

    // Assign scrollTop and scrollLeft to other body element,
    // then get scrollTop and scrollLeft back from the element
    // as the browser may have limited the values
    otherBodyEl.scrollTop = otherScrollTop;
    otherBodyEl.scrollLeft = otherScrollLeft;
    this.scrollInfo[otherClassName] = {
      top: otherBodyEl.scrollTop,
      left: otherBodyEl.scrollLeft
    };

    // console.log(this.scrollInfo);

    this.isRepaintRequired = true;
  }

  updateLines() {
    if (!this.middleEl || !this.scrollInfo) {
      return;
    }
    if (this.isRepaintRequired) {
      let width = this.middleEl.offsetWidth;
      let height = this.middleEl.offsetHeight;
      let scrollTopA = this.scrollInfo['doc-body docA'].top;
      let scrollTopB = this.scrollInfo['doc-body docB'].top;
      let tags = [];
      tags.push(`<svg width="${width}" height="${this.middleEl.offsetHeight}">`);
      for (let i = 0; i < this.changePositions.length; i++) {
        let change = this.changes[i];
        if (!change.added && !change.removed && !change.modified) {
          continue;
        }
        let changePos = this.changePositions[i];
        let topA = changePos.a.top - scrollTopA;
        let bottomA = changePos.a.bottom - scrollTopA;
        let topB = changePos.b.top - scrollTopB;
        let bottomB = changePos.b.bottom - scrollTopB;

        if (bottomA < 0 && bottomB < 0) {
          continue;
        }
        if (topA > height && topB > height) {
          continue;
        }

        let color = null;
        if (change.added) { color = 'rgba(85, 204, 85, 0.5)'; }  // '#5C5'
        if (change.removed) { color = 'rgba(255, 85, 85, 0.5)'; }  // '#F55'
        if (change.modified) { color = 'rgba(0, 153, 255, 0.5)'; }  // '#09F'
        tags.push(`<polygon points="0,${bottomA} 0,${topA} ${width},${topB} ${width},${bottomB}" `);
        tags.push(`style="fill:${color};stroke-width:0;" />`);
      }
      tags.push('</svg>');

      this.middleEl.innerHTML = tags.join('');
      this.isRepaintRequired = false;
    }
    window.requestAnimationFrame(this.updateLines);
  }

}


export { App };
