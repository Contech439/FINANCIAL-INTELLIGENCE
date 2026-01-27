'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../utils/supabase/client';

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      // 1. Ambil User ID saat ini
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('User tidak ditemukan');

      // 2. Buat Organisasi Baru
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: orgName,
          slug: orgName.toLowerCase().replace(/\s+/g, '-'), // Contoh: "Toko Makmur" -> "toko-makmur"
          email: user.email, // Default email perusahaan = email user
        })
        .select()
        .single();

      if (orgError) throw orgError;

      // 3. Masukkan User sebagai OWNER di Organisasi tersebut
      const { error: memberError } = await supabase
        .from('organization_members')
        .insert({
          organization_id: org.id,
          user_id: user.id,
          role: 'owner',
        });

      if (memberError) throw memberError;

      // 4. Sukses! Masuk ke Dashboard
      router.push('/dashboard');
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Gagal membuat organisasi: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md space-y-8 bg-white p-8 shadow-lg rounded-xl">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Selamat Datang!</h2>
          <p className="mt-2 text-gray-600">
            Mari siapkan ruang kerja untuk perusahaan Anda.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-100 text-red-700 rounded text-sm">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleCreateOrg} className="mt-8 space-y-6">
          <div>
            <label className="text-sm font-medium text-gray-700">
              Nama Perusahaan / Bisnis
            </label>
            <input
              type="text"
              required
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              placeholder="Contoh: PT. Maju Mundur atau Toko Budi"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
            />
            <p className="mt-1 text-xs text-gray-500">
              Ini akan menjadi identitas dalam invoice Anda.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {loading ? 'Sedang Menyiapkan...' : 'Mulai Sekarang 🚀'}
          </button>
        </form>
      </div>
    </div>
  );
}
