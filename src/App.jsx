import React, { useState, useMemo, useEffect } from 'react';
import { Trophy, Zap, Activity, Target, Plus, Trash2, Save, RotateCcw, Pencil, X } from 'lucide-react';
import { supabase } from './supabaseClient'; // 2단계에서 만든 파일 import

const BaseballDashboard = () => {
  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(true);

  // 1. [데이터 불러오기] 앱이 켜질 때 DB에서 가져옴
  const fetchPlayers = async () => {
    setLoading(true);
    // players 테이블의 모든(*) 데이터를 가져와라, id 순서대로 정렬해서.
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .order('id', { ascending: true });

    if (error) console.error('Error fetching:', error);
    else setRawData(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchPlayers();
  }, []);

  // 입력 폼 상태 (안타는 1루타+2루타+3루타+홈런으로 저장 시 계산)
  const [inputForm, setInputForm] = useState({
    name: '', games: 0, pa: 0, single: 0, double: 0, triple: 0, homerun: 0, walks: 0, so: 0, sb: 0, sb_fail: 0
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setInputForm(prev => ({
      ...prev,
      [name]: name === 'name' ? value : Number(value)
    }));
  };

  // 2. [데이터 추가] 같은 이름 있으면 기존 기록에 합산, 없으면 Insert
  const handleAddPlayer = async (e) => {
    e.preventDefault();
    const trimmedName = (inputForm.name || '').trim();
    if (!trimmedName) return alert('선수 이름을 입력해주세요.');

    const newHits = (inputForm.single ?? 0) + (inputForm.double ?? 0) + (inputForm.triple ?? 0) + (inputForm.homerun ?? 0);

    const { data: existingList } = await supabase
      .from('players')
      .select('*')
      .ilike('name', trimmedName)
      .limit(1);

    if (existingList && existingList.length > 0) {
      const existing = existingList[0];
      const merged = {
        name: existing.name,
        games: (existing.games ?? 0) + (inputForm.games ?? 0),
        pa: (existing.pa ?? 0) + (inputForm.pa ?? 0),
        hits: (existing.hits ?? 0) + newHits,
        double: (existing.double ?? 0) + (inputForm.double ?? 0),
        triple: (existing.triple ?? 0) + (inputForm.triple ?? 0),
        homerun: (existing.homerun ?? 0) + (inputForm.homerun ?? 0),
        walks: (existing.walks ?? 0) + (inputForm.walks ?? 0),
        so: (existing.so ?? 0) + (inputForm.so ?? 0),
        sb: (existing.sb ?? 0) + (inputForm.sb ?? 0),
        sb_fail: (existing.sb_fail ?? 0) + (inputForm.sb_fail ?? 0)
      };
      const { error } = await supabase.from('players').update(merged).eq('id', existing.id);
      if (error) alert('합산 저장 실패: ' + error.message);
      else {
        fetchPlayers();
        setInputForm({ name: '', games: 0, pa: 0, single: 0, double: 0, triple: 0, homerun: 0, walks: 0, so: 0, sb: 0, sb_fail: 0 });
      }
    } else {
      const row = { ...inputForm, name: trimmedName, hits: newHits };
      delete row.single;
      const { error } = await supabase.from('players').insert([row]);
      if (error) {
        alert('저장 실패: ' + error.message);
      } else {
        fetchPlayers();
        setInputForm({ name: '', games: 0, pa: 0, single: 0, double: 0, triple: 0, homerun: 0, walks: 0, so: 0, sb: 0, sb_fail: 0 });
      }
    }
  };

  // 수정 모달 상태
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '', games: 0, pa: 0, single: 0, double: 0, triple: 0, homerun: 0, walks: 0, so: 0, sb: 0, sb_fail: 0
  });

  const handleEditClick = (p) => {
    setEditingId(p.id);
    setEditForm({
      name: p.name || '',
      games: p.games ?? 0,
      pa: p.pa ?? 0,
      single: p.single ?? 0,
      double: p.double ?? 0,
      triple: p.triple ?? 0,
      homerun: p.homerun ?? 0,
      walks: p.walks ?? 0,
      so: p.so ?? 0,
      sb: p.sb ?? 0,
      sb_fail: p.sb_fail ?? 0
    });
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => ({
      ...prev,
      [name]: name === 'name' ? value : Number(value)
    }));
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingId) return;
    const hits = (editForm.single ?? 0) + (editForm.double ?? 0) + (editForm.triple ?? 0) + (editForm.homerun ?? 0);
    const row = { name: editForm.name, games: editForm.games, pa: editForm.pa, hits, double: editForm.double, triple: editForm.triple, homerun: editForm.homerun, walks: editForm.walks, so: editForm.so, sb: editForm.sb, sb_fail: editForm.sb_fail };
    const { error } = await supabase.from('players').update(row).eq('id', editingId);
    if (error) alert('수정 실패: ' + error.message);
    else { fetchPlayers(); setEditingId(null); }
  };

  // 3. [데이터 삭제] DB에서 Delete
  const handleDelete = async (id) => {
    if(window.confirm('정말 삭제하시겠습니까? (복구 불가)')) {
        const { error } = await supabase
          .from('players')
          .delete()
          .eq('id', id); // id가 일치하는 행 삭제

        if (error) alert('삭제 실패');
        else fetchPlayers(); // 삭제 후 목록 갱신
    }
  };

  // -----------------------------------------------------------------------
  // [계산 로직] (기존과 동일, 변수명만 DB 컬럼명에 맞춰 sbFail -> sb_fail 주의)
  // -----------------------------------------------------------------------
  const players = useMemo(() => {
    if (!rawData || rawData.length === 0) return [];

    const calculated = rawData.map(p => {
      // DB 컬럼명이 snake_case(sb_fail)일 경우를 대비해 매핑 확인
      const sbFailVal = p.sb_fail || 0; 

      const atBats = p.pa - p.walks; 
      const single = p.hits - (p.double + p.triple + p.homerun);
      const totalBases = single + (p.double * 2) + (p.triple * 3) + (p.homerun * 4);
      
      const avg = atBats > 0 ? p.hits / atBats : 0;
      const obp = p.pa > 0 ? (p.hits + p.walks) / p.pa : 0;
      const slg = atBats > 0 ? totalBases / atBats : 0;
      const ops = obp + slg;
      
      const sbTotal = p.sb + sbFailVal;
      const sbRate = sbTotal > 0 ? (p.sb / sbTotal) * 100 : 0;
      const soVal = p.so ?? 0;
      const bb_k = soVal > 0 ? (p.walks ?? 0) / soVal : null; // 볼삼비 = 볼넷/삼진, 삼진 0이면 표시 안 함

      // RC: (안타+볼넷)*totalBases + 볼넷 기여(출루 가치). 볼넷만 있어도 RC > 0
      const walkValue = 0.26; // 볼넷 1개당 대략적인 run 기여
      const rc = p.pa > 0
        ? (((p.hits + p.walks) * totalBases) + (p.walks ?? 0) * walkValue) / p.pa
        : 0;

      return { ...p, atBats, single, avg, obp, slg, ops, rc, sbRate, bb_k };
    });

    const teamTotalRC = calculated.reduce((acc, cur) => acc + cur.rc, 0);
    const teamAvgRC = calculated.length ? teamTotalRC / calculated.length : 0;
    // 팀 평균 = 선수별 RC/PA의 평균. rc는 이미 (…)/PA 이라 타석당 비율임.
    const avgRCperPA = calculated.length
      ? calculated.reduce((acc, cur) => acc + (cur.pa > 0 ? cur.rc : 0), 0) / calculated.length
      : 0;

    return calculated.map(p => {
      // wRC: 팀 내 평균 = 100. rc는 이미 타석당 비율이므로 p.rc 그대로 사용 (p.rc/p.pa 아님).
      let wRC_plus = 0;
      if (p.pa > 0 && avgRCperPA > 0) {
        const playerRCperPA = p.rc; // rc가 이미 runs per PA
        wRC_plus = Math.round((playerRCperPA / avgRCperPA) * 1000) / 10;
      }
      const war = (p.rc - teamAvgRC) / 5;
      return { ...p, wRC_plus, war };
    });
  }, [rawData]);

  const [sortKey, setSortKey] = useState('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [showPA, setShowPA] = useState(false); // 타석 컬럼: 기본 숨김, 토글로 표시
  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => {
      if (sortKey === 'name') {
        return sortAsc
          ? (a.name || '').localeCompare(b.name || '', 'ko')
          : (b.name || '').localeCompare(a.name || '', 'ko');
      }
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      return sortAsc ? av - bv : bv - av;
    });
  }, [players, sortKey, sortAsc]);

  const handleSort = (key) => {
    if (sortKey === key) setSortAsc((prev) => !prev);
    else {
      setSortKey(key);
      setSortAsc(key === 'name');
    }
  };
  
  const getTopPlayer = (key) => {
      if (players.length === 0) return { name: '-', war: 0, ops: 0, obp: 0, slg: 0, walks: 0, homerun: 0 };
      return [...players].sort((a, b) => b[key] - a[key])[0];
  }

  // 로딩 중일 때 표시
  if (loading) return <div className="min-h-screen bg-slate-950 text-white flex justify-center items-center">Loading Data...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      
      {/* Header Area */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
            배트맨 리턴즈
          </h1>
          {/* <p className="text-slate-400 text-sm flex items-center gap-2">
            Team Stats & Analytics 
            <span className="text-[10px] bg-emerald-900 text-emerald-300 px-2 py-0.5 rounded border border-emerald-700">Online DB Connected</span>
          </p> */}
        </div>
        
        {/* 팀 요약 스탯 (동일) */}
        <div className="flex gap-4 bg-slate-900 p-3 rounded-xl border border-slate-800">
             {/* ...기존 코드 유지... */}
             <div className="text-center px-2">
                <div className="text-[10px] text-slate-500">AVG</div>
                <div className="font-mono font-bold">
                {(players.length > 0 ? players.reduce((acc, p) => acc + p.avg, 0) / players.length : 0).toFixed(3)}
                </div>
            </div>
             {/* ... */}
        </div>
      </div>

      {/* Input Form Area */}
      <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-2xl mb-8 backdrop-blur-sm">
        <form onSubmit={handleAddPlayer} className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {/* Input 필드들의 name 속성을 DB 컬럼명과 일치시켜야 함. 
                예: sbFail -> sb_fail로 변경 필요하면 변경. 위 코드에서는 로직에서 처리함 */}
             <div className="col-span-2 md:col-span-1">
                <label className="block text-xs text-slate-500 mb-1">선수명</label>
                <input type="text" name="name" value={inputForm.name} onChange={handleInputChange} className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 outline-none" placeholder="이름" />
            </div>
             <div>
                <label className="block text-xs text-slate-500 mb-1">경기수</label>
                <input type="number" name="games" value={inputForm.games} onChange={handleInputChange} className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-center" min="0" />
             </div>
             <div>
                <label className="block text-xs text-slate-500 mb-1">타석</label>
                <input type="number" name="pa" value={inputForm.pa} onChange={handleInputChange} className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-center" />
             </div>
             <div>
                <label className="block text-xs text-slate-500 mb-1">1루타</label>
                <input type="number" name="single" value={inputForm.single} onChange={handleInputChange} className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-center" min="0" />
             </div>
             <div>
                <label className="block text-xs text-slate-500 mb-1">2루타</label>
                <input type="number" name="double" value={inputForm.double} onChange={handleInputChange} className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-center" />
             </div>
             <div>
                <label className="block text-xs text-slate-500 mb-1">3루타</label>
                <input type="number" name="triple" value={inputForm.triple} onChange={handleInputChange} className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-center" />
             </div>
             <div>
                <label className="block text-xs text-slate-500 mb-1">홈런</label>
                <input type="number" name="homerun" value={inputForm.homerun} onChange={handleInputChange} className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-center" />
             </div>
             <div>
                <label className="block text-xs text-slate-500 mb-1 text-yellow-500">볼넷</label>
                <input type="number" name="walks" value={inputForm.walks} onChange={handleInputChange} className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-center" />
             </div>
             <div>
                <label className="block text-xs text-slate-500 mb-1">삼진</label>
                <input type="number" name="so" value={inputForm.so} onChange={handleInputChange} className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-center" min="0" />
             </div>
             <div>
                <label className="block text-xs text-slate-500 mb-1">도루</label>
                <input type="number" name="sb" value={inputForm.sb} onChange={handleInputChange} className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-center" />
             </div>
             <div>
                <label className="block text-xs text-slate-500 mb-1">도루실패</label>
                <input type="number" name="sb_fail" value={inputForm.sb_fail} onChange={handleInputChange} className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-center" />
            </div>

            <div className="col-span-2 md:col-span-1 flex items-end">
                <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded transition flex justify-center items-center gap-2">
                <Save size={18} /> 저장 (DB)
                </button>
            </div>
        </form>
      </div>

      {/* Dashboard Cards & Table (기존과 동일, 데이터 소스만 rawData로 변경됨) */}
      {/* ... */}
      {/* ... 아래쪽 테이블 코드 기존과 동일 ... */}
       <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg mt-8">
        <div className="flex items-center justify-end gap-2 px-4 py-2 border-b border-slate-800">
          <button
            type="button"
            onClick={() => setShowPA((v) => !v)}
            className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded border border-slate-600 hover:border-slate-500 transition"
          >
            {showPA ? '타석 숨기기' : '타석 열기'}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col className="w-24 min-w-[6rem]" />
              <col className="w-14" />
              <col className="w-16" />
              <col className="w-16" />
              <col className="w-14" />
              <col className="w-14" />
              {showPA && <col className="w-14" />}
              <col className="w-16" />
              <col className="w-14" />
              <col className="w-14" />
              <col className="w-14" />
              <col className="w-14" />
              <col className="w-14" />
              <col className="w-14" />
              <col className="w-14" />
              <col className="w-14" />
              <col className="w-14" />
              <col className="w-16" />
              <col className="w-24" />
            </colgroup>
            <thead className="bg-slate-800 text-slate-300 text-xs uppercase">
              <tr>
                {[
                  { key: 'name', label: '선수명', align: 'left' },
                  { key: 'games', label: '경기수', align: 'right' },
                  { key: 'avg', label: '타율', align: 'right' },
                  { key: 'obp', label: '출루율', align: 'right' },
                  { key: 'atBats', label: '타수', align: 'right' },
                  { key: 'hits', label: '안타', align: 'right' },
                  ...(showPA ? [{ key: 'pa', label: '타석', align: 'right' }] : []),
                  { key: 'ops', label: 'OPS', align: 'right' },
                  { key: 'wRC_plus', label: 'wRC', align: 'right' },
                  { key: 'walks', label: '볼넷', align: 'right' },
                  { key: 'so', label: '삼진', align: 'right' },
                  { key: 'bb_k', label: '볼삼비', align: 'right' },
                  { key: 'sb', label: '도루', align: 'right' },
                  { key: 'single', label: '1루타', align: 'right' },
                  { key: 'double', label: '2루타', align: 'right' },
                  { key: 'triple', label: '3루타', align: 'right' },
                  { key: 'homerun', label: '홈런', align: 'right' },
                  { key: 'sb_fail', label: '도루실패', align: 'right' },
                ].map(({ key, label, align }) => (
                  <th
                    key={key}
                    onClick={() => handleSort(key)}
                    className={`py-3 px-2 whitespace-nowrap cursor-pointer hover:text-white hover:bg-slate-700 transition ${align === 'left' ? 'text-left pl-4' : 'text-right'}`}
                  >
                    {label}
                    {sortKey === key && (sortAsc ? ' ↑' : ' ↓')}
                  </th>
                ))}
                <th className="py-3 px-2 text-center w-24">수정 / 삭제</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {sortedPlayers.length === 0 ? (
                <tr>
                  <td colSpan={showPA ? 19 : 18} className="px-4 py-8 text-center text-slate-500">
                    등록된 선수 기록이 없습니다. 위 폼에서 선수를 추가해보세요.
                  </td>
                </tr>
              ) : (
                sortedPlayers.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-800/50 transition">
                    <td className="py-3 pl-4 pr-2 font-medium text-white sticky left-0 bg-slate-900 z-10 text-left">{p.name}</td>
                    <td className="py-3 px-2 font-mono text-right tabular-nums">{p.games ?? 0}</td>
                    <td className="py-3 px-2 font-mono text-right tabular-nums">{typeof p.avg === 'number' ? p.avg.toFixed(3) : '-'}</td>
                    <td className="py-3 px-2 font-mono text-right tabular-nums">{typeof p.obp === 'number' ? p.obp.toFixed(3) : '-'}</td>
                    <td className="py-3 px-2 font-mono text-right tabular-nums">{p.atBats ?? 0}</td>
                    <td className="py-3 px-2 font-mono text-right tabular-nums">{p.hits ?? 0}</td>
                    {showPA && <td className="py-3 px-2 font-mono text-right tabular-nums">{p.pa ?? 0}</td>}
                    <td className="py-3 px-2 font-mono text-right tabular-nums">{typeof p.ops === 'number' ? p.ops.toFixed(3) : '-'}</td>
                    <td className="py-3 px-2 font-mono text-right tabular-nums">{typeof p.wRC_plus === 'number' ? p.wRC_plus.toFixed(1) : '-'}</td>
                    <td className="py-3 px-2 font-mono text-right tabular-nums">{p.walks ?? 0}</td>
                    <td className="py-3 px-2 font-mono text-right tabular-nums">{p.so ?? 0}</td>
                    <td className="py-3 px-2 font-mono text-right tabular-nums">{p.bb_k != null ? p.bb_k.toFixed(2) : '-'}</td>
                    <td className="py-3 px-2 font-mono text-right tabular-nums">{p.sb ?? 0}</td>
                    <td className="py-3 px-2 font-mono text-right tabular-nums">{p.single ?? 0}</td>
                    <td className="py-3 px-2 font-mono text-right tabular-nums">{p.double ?? 0}</td>
                    <td className="py-3 px-2 font-mono text-right tabular-nums">{p.triple ?? 0}</td>
                    <td className="py-3 px-2 font-mono text-right tabular-nums">{p.homerun ?? 0}</td>
                    <td className="py-3 px-2 font-mono text-right tabular-nums">{p.sb_fail ?? 0}</td>
                    <td className="py-3 px-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => handleEditClick(p)} className="text-slate-400 hover:text-amber-400 transition p-1 inline-flex items-center justify-center" title="수정">
                          <Pencil size={16} />
                        </button>
                        <button onClick={() => handleDelete(p.id)} className="text-slate-600 hover:text-red-400 transition p-1 inline-flex items-center justify-center" title="삭제">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 수정 모달 */}
      {editingId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setEditingId(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <h3 className="text-lg font-semibold text-white">기록 수정</h3>
              <button type="button" onClick={() => setEditingId(null)} className="p-1 text-slate-400 hover:text-white rounded">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs text-slate-500 mb-1">선수명</label>
                <input type="text" name="name" value={editForm.name} onChange={handleEditChange} className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 outline-none" required />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">경기수</label>
                <input type="number" name="games" value={editForm.games} onChange={handleEditChange} className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-center" min="0" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">타석</label>
                <input type="number" name="pa" value={editForm.pa} onChange={handleEditChange} className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-center" min="0" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">1루타</label>
                <input type="number" name="single" value={editForm.single} onChange={handleEditChange} className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-center" min="0" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">2루타</label>
                <input type="number" name="double" value={editForm.double} onChange={handleEditChange} className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-center" min="0" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">3루타</label>
                <input type="number" name="triple" value={editForm.triple} onChange={handleEditChange} className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-center" min="0" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">홈런</label>
                <input type="number" name="homerun" value={editForm.homerun} onChange={handleEditChange} className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-center" min="0" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">볼넷</label>
                <input type="number" name="walks" value={editForm.walks} onChange={handleEditChange} className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-center" min="0" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">삼진</label>
                <input type="number" name="so" value={editForm.so} onChange={handleEditChange} className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-center" min="0" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">도루</label>
                <input type="number" name="sb" value={editForm.sb} onChange={handleEditChange} className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-center" min="0" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">도루실패</label>
                <input type="number" name="sb_fail" value={editForm.sb_fail} onChange={handleEditChange} className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-center" min="0" />
              </div>
              <div className="col-span-2 sm:col-span-4 flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setEditingId(null)} className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 transition">
                  취소
                </button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center gap-2 transition">
                  <Save size={18} /> 수정 저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
    </div>
  );
};

export default BaseballDashboard;