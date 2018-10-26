'use strict';

/* common0.js の簡略版：
charmod-ja.html のみ
*/

// 要素取得
function E(id){
//	const e = document.getElementById(id);if(!e) {console.log(id);};return e;
	return document.getElementById(id);
}

// 要素作成
function C(tag){
	return tag ? 
		document.createElement(tag) :
		document.createDocumentFragment();
}

function EMPTY_FUNC(){}

// セレクタ対象の要素を反復処理
function repeat(selector, callback, root){
	if(!root) root = document
	const elements = root.querySelectorAll(selector);
	const L = elements.length;
	for(let i = 0; i < L; i++){
		callback(elements[i]);
	}
}

const PAGE_DATA = Object.create(null); 
/* possible members:
options:
	see common1.js
ref_normative:
ref_informative:
	参照文献データ
original_id_map:
	訳文 id → 原文 id
spec_metadata
	仕様メタデータ
words_table:
	単語対応

*/

const COMMON_DATA = Object.create(null);

// 予約済みメンバ
const Util = {
	_COMP_: null,
	DEFERRED: [], // 遅延実行
	initAdditional: EMPTY_FUNC,
	getState: EMPTY_FUNC, // 状態保存
	setState: EMPTY_FUNC,

	get_mapping: EMPTY_FUNC,
	getDataByLevel: EMPTY_FUNC,
	get_header: EMPTY_FUNC,
	dump: EMPTY_FUNC,

	ready: EMPTY_FUNC,
	rebuildToc: EMPTY_FUNC,
	buildTocList: EMPTY_FUNC,
	parseSourceBlock: EMPTY_FUNC,

// common0a.js
	word_switcher: null,

// common1.js
	ADDITIONAL_NODES: [],
//	CONTROL_UI: C(), //追加 UI
	CLICK_HANDLERS: {},

	removeAdditionalNodes: EMPTY_FUNC,
	indexHide: EMPTY_FUNC,
	dfnHide: EMPTY_FUNC,
	dfnInit: EMPTY_FUNC,
	altLinkInit: EMPTY_FUNC,
	fillMisc: EMPTY_FUNC,
	toggleSource: EMPTY_FUNC,

	indexInit: EMPTY_FUNC,

	switchView: EMPTY_FUNC,
	ref_position: null,
	page_state: Object.create(null),
	saveStorage: EMPTY_FUNC,
//	supportsListenerOptions: false,

	XXXXX: EMPTY_FUNC
};



// 改行／コロン区切りの文字列データから連想配列を取得
Util.get_mapping = function(data, map){
	map = map || Object.create(null);

	const rxp = /\n(\S.*?):(.*)/g
	let m;
	while(m = rxp.exec(data)){
		map[m[1]] = m[2];
	}
	return map;
};

// ●●区切りの文字列から有名データブロックを抽出
Util.parseBlocks = function(source){
//	const rxp = RegExp('(\n' + splitter + ').+');
	const result = Object.create(null);
	let name = '';
	source.split(/(\n●●.*)/).forEach(function(block){
		if(block.slice(0,3) === '\n●●'){
			name = block.slice(3);
			if(!name){
				// 無名ブロックはコメント
				return;
			}
			if(!(name in result)){
				result[name] = '';
			}
		}else if(name){
			result[name] += block;
		}
	});
	return result;
}

/* 
'token:word1:word2:word3:...' の形式の各行を
'token:word' の形に変換 ( word = level 番目の word )

	word === 空 の場合
		word = 最も level が高い空でない word
	word === '~' の場合
		恒等置換

*/

Util.getDataByLevel = function(data, level){
	return data
	// スペース／タブ開始行を削除
		.replace(/\n[ \t].*/g, '')
	// ":" 区切りの行フィールド数を level + 1 個に圧縮
	// level = 2 の場合: /((:[^:\n]*){3}).*/g ( w:w1:w2:w3 => w:w1:w2 )
		.replace(RegExp('((:[^:\\n]*){' + ((level & 0xF) + 1) + '}).*', 'g'), '$1')
	// 省略されたフィールドを補填 ( …w::\n => w:w\n)
		.replace(/([^:\n]*):+(?=\n)/g, '$1:$1')
	// 合間のフィールドをカット
		.replace(/:.*:/g, ':')
//		token が '-' で終端している場合 token:( token から末尾の '-' を除去した結果 ) に置換
//		.replace(/^(.*)-:~$/mg, '$1-:$1')
	// "~" への map （恒等置換 指示）は削除
		.replace(/^.*:~$/mg, '')
	;
};


// 節見出しを取得
Util.get_header = function(section){
	const header = section && section.firstElementChild;
	return (
		header && /^H\d$/.test(header.tagName)
	)? header : null;
};


Util.getState = function(key, default_val, type){
	if(! (key in Util.page_state) ) return default_val;
	const val = Util.page_state[key];
	return (type && (typeof(val) !== type))? default_val : val;
};

Util.setState = function(key, val){
	const page_state = Util.page_state;
	const old_val = page_state[key];
	if(val === old_val) return;
	if(val === undefined){
		delete page_state[key];
	} else {
		page_state[key] = val;
	}

	history.replaceState( page_state, '' );
	Util.saveStorage(page_state);
};


new function(){
	if(!window.console){
		window.console = { log: EMPTY_FUNC };
	}
}

new function(){
	// meta with viewport for mbile (ideally, should be set by CSS, not meta tag)
	const head = document.head || document.getElementsByTagName('head')[0];
	if(!head) return;
//	const w = screen.width;...
	const meta = C('meta');
	meta.setAttribute('name', 'viewport');
	meta.setAttribute('content', 'width=device-width, initial-scale=1, shrink-to-fit=no');
	head.appendChild(meta);
}

new function(){
	Util._COMP_ = new Promise(function(resolve){
		document.addEventListener('DOMContentLoaded', function(){
			init();
			resolve();
		}, false);
	});

	// 初期化
	function init(){
		document.removeEventListener('DOMContentLoaded', init, false);

		const elem = E('_source_data');
		if(elem){
			Object.assign(PAGE_DATA, Util.parseBlocks(elem.textContent));
			elem.parentNode.removeChild(elem);
		}

		const options =
		PAGE_DATA.options = Util.get_mapping(PAGE_DATA.options || '');

		// 利用者 表示設定
		let page_state = (JSON && get_state()) // setup saveStorage
		Util.page_state = page_state = history.state || page_state || Util.page_state;

		const classList = document.body.classList;

		if(page_state.show_original){
			classList.toggle('show-original');
		}
		if(page_state.side_menu){
			classList.toggle('side-menu');
		}
		if(classList.contains('_expanded')){
			// ページは展開状態で保存されている
			options.expanded = true;
			repeat('._hide_if_expanded', function(e){
				e.style.display = 'none';
			});
		} else {
			Util.ready();
			classList.add('_expanded');
			if(options.toc){
				// 目次構築
				const toc_list = Util.buildTocList(E(options.main));
				toc_list.id = '_toc_list';
				E(options.toc).appendChild(toc_list);
			}
		}
	}

	// 表示状態を sessionStorage から読み込む
	function get_state(){
		let page_state = null;
		let storage_key = null;

		storage_key = PAGE_DATA.options.page_state_key || window.location.pathname;
		try {
// sessionStorage property へのアクセスのみでも security error になることがある
			page_state = sessionStorage.getItem(storage_key);
			Util.saveStorage = function(data){
				sessionStorage.setItem(storage_key, JSON.stringify(data));
			};
			if(! page_state || (page_state.length > 1000)) return;
			page_state = JSON.parse(page_state);
		} catch(e){
			console.log(e.message + ' failed sessionStorage.getItem');
		}
		if(page_state instanceof Object){
			return page_state;
		}
	}
}

/** 目次構築 see common0.js
*/

Util.rebuildToc = function(main_id, list_id){
	list_id = list_id || '_toc_list';
	const toc_list = E(list_id), main = E(main_id);
	if(toc_list && main) {
		const new_list = Util.buildTocList(main);
		new_list.id = list_id;
		toc_list.parentNode.replaceChild(new_list, toc_list);
	}
	return toc_list;
}

Util.buildTocList = function(root){
	const range = document.createRange();
	const toc = buildToc(root);
	if(toc) { // a 要素の入れ子を除去
		repeat('a a', function(e){
			range.selectNodeContents(e);
			e.parentNode.replaceChild(range.extractContents(), e);
		}, toc);
		repeat('[id]', function(e){ // 重複 id を除去
			e.removeAttribute('id');
		}, toc);
	}
	return toc;

	function buildToc(root){
		let list = null;
		for(let section = root.firstElementChild; 
			section;
			section = section.nextElementSibling
		){
			if('SECTION' !== section.tagName) continue;
			const header = Util.get_header(section);
			if(!header) continue;
			const id = section.id || header.id;
			if(!id) continue;
			const a = C('a');
			a.href = '#' + id;
			range.selectNodeContents(header);
			a.appendChild(range.cloneContents());

			const li = C('li');
			li.appendChild(a);

			const child_list = buildToc(section);
			if(child_list) li.appendChild(child_list);
			if(!list) list = C('ol');
			list.appendChild(li);
		}
		return list;
	}
}



/** 語彙切替 （訳語 → 原語 変換）

検索パタン
	(1) 漢字+
		動詞的／名詞的 用法は、[さしすせ]が後続しているかどうかで区別
		例：
			接続（する） → connection / connect（する）
			（課題）「〜できる／〜可能」の場合も動詞的用法（例：断片化）

			「動く」のような活用形は語尾も含めて変換する必要があるので
			(3) の「漢字かな」の対象になる
	(2) 漢字+<!--.-->
		重複の区別／無変換指示のため、ドットの部分で検索キーを分岐
		例：
			指定 → specify / designate
			概念 → notion / concept
			取得 → fetch / retrieve / obtain
		ドットの部分が '0' ならば無変換を指示
	(3) 漢字+かな+<!--.-->
		例：予約済み → reserved
		ドットは意味を持たない
	(5) カナ+
	(4) 漢字+カナ+
		例：下位プロトコル → subprotocol
	(6) カナ+漢字+
		例： "サービス供与" → serve, "リソース名" → resource name
	(課題)
		例：
			割り当てる → allocate する
			あてがう → assign する
			呼び出す → invoke する
			呼び出さない → invoke しない
			ページ遷移（する） → navigation / navigate
			待ち行列 → queue
		<漢字><かな>(?=<漢字>) を複合 処理の対象にする？
		[一-龠][ぁ-ゔ]

[\u4E00-\u9FFF] : CJK [一-鿆]
[\u30A1-\u30FC] : カナ [ァ-ー] // "・" も含まれる
[\u3041-\u3094] : かな [ぁ-ゔ]

*/

Util.word_switcher = {
	rxp: 
/(?:(?:[\u30A1-\u30FC]+|[\u4E00-\u9FFF]+)([\u3041-\u3094]*<!--.-->)?)(?=(?:([\u30A1-\u30FC]+|[\u4E00-\u9FFF]+)|([さしすせ]|でき))?)/g,

	main_id: null,
	html: null,

	convert:function(map){
		const main = E(this.main_id);
		if(!this.html) this.html = main.innerHTML;
		let ignore_flag = false;
		main.innerHTML = this.html.replace(this.rxp, function(key, hira, suffix, sa){
			if(ignore_flag){
				ignore_flag = false;
				return (hira || '');
			}
			let val;
			if(hira){
				//(カナ+|漢字+)かな*<!--.-->
				//この場合は suffix, sa を無視
				let opt = hira.slice(-4,-3);
				key = key.slice(0,-8);
				if(opt === '0'){
					return key; // 無変換
				}
				if(hira.length > 8){
					val = map[key];
				} else {
					val = map[key + opt];
				}
			} else if(sa){
				if(key.charCodeAt(0) >= 0x4E00){
					// サ行変格
					val = map[key + '-'];
				}
			} else if(suffix){
				val = map[key + suffix];
				if(val) { // 漢字＋カナ 複合語
					ignore_flag = true;
				}
			}

			val = val || map[key];
			return val? (
				(val.charCodeAt(0) < 128 ? ' ': '')
				+ val + 
				(val.charCodeAt(val.length - 1) < 128 ? ' ': '')
			) : key;
		});
		Util.rebuildToc(this.main_id);
	},
	revert: function(){
		if(!this.html) return;
		E(this.main_id).innerHTML = this.html;
		this.html = null;
		Util.rebuildToc(this.main_id);
	},

	// 2 レベル切替用
	init_toggle: function(){
		this.main_id = PAGE_DATA.options.main;

		E('_view_control').insertAdjacentHTML( 'beforeend', 
'<input type="button" class="_hide_if_expanded" tabindex="1" id="_toggle_words" value="語の和英" accessKey="X" title ="アクセスキー： X">'
		);
		const that = this;

		Util.CLICK_HANDLERS._toggle_words = function(){
			Util.switchView(toggleWords2, true);
		}

		function toggleWords2(){
			if(that.html){
				that.revert();
			} else {
				that.convert(
					Util.get_mapping(PAGE_DATA.words_table)
				);
			}
			E('_toggle_words').className = that.html? '_converted' : '';
		}
	},

	// 3 レベル以上用
	num_levels: 3,
	level:0,
	switchWords: function(level){
		if(isNaN(level)){
			level = (this.level + 1);
		}
		level = (level & 0xF) % this.num_levels;
		if(level === this.level) return;
		this.level = level;
		let mapping;
		if(level > 0){
			mapping = 
				Util.getDataByLevel(PAGE_DATA.words_table, level - 1 )
				// 恒等置換 削除
				.replace(/^([^\n:]+)[\d\-]?:\1$/mg, '');
			mapping = Util.get_mapping(mapping);
		}
		const that = this;
		Util.switchView(function(){
			level ?
				that.convert(mapping) :
				that.revert();
		}, true);
	}
};
