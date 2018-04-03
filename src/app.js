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
      <div className="doc-head">
        {props.doc.filename}
      </div>
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
          chunksA.push(this.getHtml(change.value));
          chunksB.push(this.getHtml(change.value));

          lineNumberA += change.count;
          lineNumberB += change.count;
        }

        change.lineNumbers.a.end = lineNumberA;
        change.lineNumbers.b.end = lineNumberB; 
      }

      comparison.docA.changesHtml = chunksA.join('');
      comparison.docB.changesHtml = chunksB.join('');
    
      // Determine the changes for drawing lines and scroll locking
      comparison.changes = comparison.diffs.filter((change) => {
        return (change.added || change.removed || change.modified);
      });

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
        {/*
        <Menu comparisons={this.state.comparisons} />
        */}
        <Doc className="docA" doc={comparison.docA} />
        <Middle />
        <Doc className="docB" doc={comparison.docB} />
      </div>
    );
  }

  renderOverlays() {
    console.log('XXX renderOverlays');
    // var matches = document.querySelectorAll("iframe[data-change]");

    this.scrollInfo = {};
    let docBodyElements = document.querySelectorAll('.doc-body');
    for (let el of docBodyElements) {
      el.removeEventListener('scroll', this.onScroll);
      el.addEventListener('scroll', this.onScroll);
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
      this.changePositions.push({
        a: {
          top: changeElsA[i].offsetTop,
          bottom: changeElsA[i].offsetTop + changeElsA[i].offsetHeight
        },
        b: {
          top: changeElsB[i].offsetTop,
          bottom: changeElsB[i].offsetTop + changeElsB[i].offsetHeight
        }
      });
    }

    // console.log(this.scrollInfo);

    this.middleEl = document.querySelector('.middle');

    this.updateLines();
  }

  onScroll(e) {
    this.scrollInfo[e.target.className] = {
      top: e.target.scrollTop,
      left: e.target.scrollLeft
    };
    this.updateLines();
  }

  updateLines() {
    // console.log('XXX updateLines');
    if (!this.middleEl || !this.scrollInfo) {
      return;
    }
    // console.log('QQQ', this.middleEl.children);
    for (let el of this.middleEl.children) {
      el.remove();
    }
    // console.log('QQQ', this.middleEl.children);
    let width = this.middleEl.offsetWidth;
    let scrollTopA = this.scrollInfo['doc-body docA'].top;
    let scrollTopB = this.scrollInfo['doc-body docB'].top;
    let tags = [];
    tags.push(`<svg width="${width}" height="${this.middleEl.offsetHeight}">`);
    for (let i = 0; i < this.changePositions.length; i++) {
      let change = this.changes[i];
      let changePos = this.changePositions[i];
      let topA = changePos.a.top - scrollTopA;
      let bottomA = changePos.a.bottom - scrollTopA;
      let topB = changePos.b.top - scrollTopB;
      let bottomB = changePos.b.bottom - scrollTopB;
      let color = '#000';
      if (change.added) { color = '#5C5'; }
      if (change.removed) { color = '#F55'; }
      if (change.modified) { color = '#09F'; }
      tags.push(`<polygon points="0,${bottomA} 0,${topA} ${width},${topB} ${width},${bottomB}" `);
      tags.push(`style="fill:${color};stroke-width:1;stroke:${color}" />`);
    }
    tags.push('</svg>');

    this.middleEl.insertAdjacentHTML('afterbegin', tags.join(''));
    // console.log(this.middleEl);
    // console.log(scrollTopA, scrollTopB);
  }

}


export { App };
