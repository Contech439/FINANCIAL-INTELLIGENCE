'use client';

import { useState, useEffect } from 'react';
import { createClient } from '../../utils/supabase/client';
import Link from 'next/link';

export default function FinancePage() {
  const supabase = createClient();

  // State Data
  const [allJournals, setAllJournals] = useState<any[]>([]); // Data Mentah
  const [filteredJournals, setFilteredJournals] = useState<any[]>([]); // Data Tampil
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL'); // ALL, INCOME, EXPENSE, EQUITY

  // State Modal Setor Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [modalData, setModalData] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: '',
    account_id: '',
    description: 'Setoran Modal Awal',
  });

  useEffect(() => {
    fetchJournals();
    fetchAccounts();
  }, []);

  // Efek Filter: Setiap kali filter atau data berubah, hitung ulang tampilan
  useEffect(() => {
    applyFilter();
  }, [filter, allJournals]);

  const fetchJournals = async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: members } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();
    const orgId = members!.organization_id;

    const { data } = await supabase
      .from('journal_entries')
      .select(
        `
            id, transaction_date, reference, description,
            journal_lines (
                debit, credit,
                chart_of_accounts (name, code, type)
            )
        `
      )
      .eq('organization_id', orgId)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (data) {
      setAllJournals(data);
      setFilteredJournals(data); // Default tampil semua
    }
    setLoading(false);
  };

  // --- LOGIKA FILTER FRONTEND ---
  const applyFilter = () => {
    if (filter === 'ALL') {
      setFilteredJournals(allJournals);
      return;
    }

    const result = allJournals.filter((journal) => {
      // Cek setiap baris jurnal, apakah mengandung akun tipe tertentu
      const hasType = journal.journal_lines.some((line: any) => {
        const type = line.chart_of_accounts?.type;

        if (filter === 'INCOME') return type === 'income'; // Akun Pendapatan 4xxx
        if (filter === 'EXPENSE') return type === 'expense'; // Akun Beban 6xxx
        if (filter === 'EQUITY') return type === 'equity'; // Akun Modal 3xxx
        return false;
      });
      return hasType;
    });
    setFilteredJournals(result);
  };

  const fetchAccounts = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: members } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user!.id)
      .single();
    const { data } = await supabase
      .from('chart_of_accounts')
      .select('id, name, code')
      .eq('organization_id', members!.organization_id)
      .eq('type', 'asset')
      .or('name.ilike.%kas%,name.ilike.%bank%');
    if (data) setAccounts(data);
  };

  const handleCapitalInjection = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data: members } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user!.id)
        .single();
      const orgId = members!.organization_id;

      const { data: equityAccount } = await supabase
        .from('chart_of_accounts')
        .select('id')
        .eq('organization_id', orgId)
        .eq('code', '3001')
        .single();
      if (!equityAccount) throw new Error('Akun Modal (3001) tidak ditemukan.');

      const { data: journal, error: jError } = await supabase
        .from('journal_entries')
        .insert({
          organization_id: orgId,
          transaction_date: modalData.date,
          reference: 'MODAL-' + Date.now().toString().slice(-4),
          description: modalData.description,
        })
        .select()
        .single();

      if (jError) throw jError;

      const amount = Number(modalData.amount);
      // Debit Kas
      await supabase.from('journal_lines').insert({
        organization_id: orgId,
        journal_entry_id: journal.id,
        account_id: modalData.account_id,
        debit: amount,
        credit: 0,
      });
      // Kredit Modal
      await supabase.from('journal_lines').insert({
        organization_id: orgId,
        journal_entry_id: journal.id,
        account_id: equityAccount.id,
        debit: 0,
        credit: amount,
      });

      alert('Berhasil! Modal telah disetor.');
      setIsModalOpen(false);
      fetchJournals();
    } catch (err: any) {
      alert('Gagal: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatRupiah = (val: number) =>
    parseInt(val.toString()).toLocaleString('id-ID');

  const getBadgeColor = (type: string) => {
    switch (type) {
      case 'asset':
        return 'bg-blue-100 text-blue-700';
      case 'liability':
        return 'bg-red-100 text-red-700';
      case 'equity':
        return 'bg-purple-100 text-purple-700';
      case 'income':
        return 'bg-green-100 text-green-700';
      case 'expense':
        return 'bg-orange-100 text-orange-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-8 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-gray-500 hover:text-blue-600">
            ← Dashboard
          </Link>
          <h1 className="text-xl font-bold text-gray-800">
            Buku Besar (General Ledger)
          </h1>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-sm font-bold shadow"
        >
          + Setor Modal Awal
        </button>
      </header>

      <main className="p-8 max-w-6xl mx-auto">
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
          <p className="text-sm text-blue-700">
            <strong>Standar Akuntansi:</strong> Semua transaksi dicatat secara
            kronologis. Gunakan filter di bawah untuk melihat kategori spesifik.
          </p>
        </div>

        {/* TABS FILTER */}
        <div className="flex space-x-2 mb-6 border-b">
          <button
            onClick={() => setFilter('ALL')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              filter === 'ALL'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Semua Transaksi
          </button>
          <button
            onClick={() => setFilter('INCOME')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              filter === 'INCOME'
                ? 'border-green-600 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Pemasukan (Income)
          </button>
          <button
            onClick={() => setFilter('EXPENSE')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              filter === 'EXPENSE'
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Pengeluaran (Expense)
          </button>
          <button
            onClick={() => setFilter('EQUITY')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              filter === 'EQUITY'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Modal & Ekuitas
          </button>
        </div>

        {/* LIST JURNAL */}
        <div className="space-y-6">
          {loading ? (
            <p className="text-center text-gray-500">Memuat data jurnal...</p>
          ) : filteredJournals.length === 0 ? (
            <p className="text-center py-12 text-gray-400 bg-white rounded border border-dashed">
              Tidak ada transaksi untuk kategori ini.
            </p>
          ) : (
            filteredJournals.map((j) => (
              <div
                key={j.id}
                className="bg-white border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition"
              >
                <div className="bg-gray-50 px-6 py-4 flex justify-between items-center border-b">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-lg text-gray-800">
                        {j.reference || 'NO-REF'}
                      </span>
                      <span className="text-xs font-mono bg-gray-200 px-2 py-1 rounded text-gray-600">
                        {new Date(j.transaction_date).toLocaleDateString(
                          'id-ID'
                        )}
                      </span>
                    </div>
                    <p className="text-gray-600 mt-1 italic">
                      "{j.description}"
                    </p>
                  </div>
                </div>

                <table className="w-full text-sm">
                  <thead className="bg-white border-b">
                    <tr>
                      <th className="px-6 py-2 text-left font-medium text-gray-400 uppercase text-xs">
                        Akun & Kode
                      </th>
                      <th className="px-6 py-2 text-right font-medium text-gray-400 uppercase text-xs">
                        Debit
                      </th>
                      <th className="px-6 py-2 text-right font-medium text-gray-400 uppercase text-xs">
                        Kredit
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {j.journal_lines.map((line: any, idx: number) => (
                      <tr
                        key={idx}
                        className="border-b last:border-0 hover:bg-gray-50"
                      >
                        <td className="px-6 py-3 text-gray-700">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] uppercase px-1.5 py-0.5 rounded font-bold ${getBadgeColor(
                                line.chart_of_accounts?.type
                              )}`}
                            >
                              {line.chart_of_accounts?.type}
                            </span>
                            <span className="font-medium">
                              {line.chart_of_accounts?.name}
                            </span>
                            <span className="text-gray-400 font-mono text-xs">
                              ({line.chart_of_accounts?.code})
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-3 text-right font-mono font-medium text-gray-800">
                          {line.debit > 0 ? formatRupiah(line.debit) : '-'}
                        </td>
                        <td className="px-6 py-3 text-right font-mono font-medium text-gray-800">
                          {line.credit > 0 ? formatRupiah(line.credit) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </div>
      </main>

      {/* Modal (Code Tetap Sama) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Setor Modal Pemilik</h3>
            <form onSubmit={handleCapitalInjection} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Tanggal Setor</label>
                <input
                  type="date"
                  required
                  className="w-full border rounded p-2"
                  value={modalData.date}
                  onChange={(e) =>
                    setModalData({ ...modalData, date: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">Jumlah Uang (Rp)</label>
                <input
                  type="number"
                  required
                  className="w-full border rounded p-2"
                  placeholder="Contoh: 100000000"
                  onChange={(e) =>
                    setModalData({ ...modalData, amount: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">
                  Masuk ke Akun (Kas/Bank)
                </label>
                <select
                  required
                  className="w-full border rounded p-2"
                  onChange={(e) =>
                    setModalData({ ...modalData, account_id: e.target.value })
                  }
                >
                  <option value="">-- Pilih Akun --</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Keterangan</label>
                <input
                  type="text"
                  className="w-full border rounded p-2"
                  value={modalData.description}
                  onChange={(e) =>
                    setModalData({ ...modalData, description: e.target.value })
                  }
                />
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-600"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="bg-green-600 text-white px-4 py-2 rounded font-bold hover:bg-green-700"
                >
                  Simpan Modal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
