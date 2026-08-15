"use client";

import React, { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { useRouter } from "next/navigation";
import api from "@/lib/axios";
import { useAuth } from "@/hooks/useAuth";
import RatingModal from "./RatingModal";

interface SellerRatingProps {
  nickname: string;
  sellerUserId: number;
  ratingAverage: number;
  ratingCount: number;
}

interface RatingItem {
  user_id?: number;
  score: number;
  comment?: string | null;
}

export default function SellerRating({
  nickname,
  sellerUserId,
  ratingAverage,
  ratingCount,
}: SellerRatingProps) {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [average, setAverage] = useState(ratingAverage);
  const [count, setCount] = useState(ratingCount);
  const [myRating, setMyRating] = useState<RatingItem | null>(null);

  const isOwnProfile = isAuthenticated && user?.id === sellerUserId;

  // Récupère l'avis de l'utilisateur courant s'il en a déposé un.
  useEffect(() => {
    if (!isAuthenticated || isOwnProfile) return;
    let active = true;
    api
      .get(`/profiles/${nickname}/ratings`, { params: { limit: 100 } })
      .then(({ data }) => {
        if (!active) return;
        const mine = (data?.data || []).find(
          (r: RatingItem) => r.user_id === user?.id
        );
        if (mine) setMyRating(mine);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [nickname, isAuthenticated, isOwnProfile, user?.id]);

  const handleRate = () => {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    if (isOwnProfile) return;
    setShowModal(true);
  };

  return (
    <>
      <div className="flex gap-2 md:gap-3 justify-center md:justify-end">
        <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex flex-col items-center justify-center min-w-[100px]">
          <div className="text-2xl font-black text-gray-900 flex items-center justify-center gap-1">
            {average > 0 ? average : "-"}
            <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
          </div>
          <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-1">
            {count > 0
              ? `${count} ${count > 1 ? "avis" : "avis"}`
              : "Aucun avis"}
          </div>
        </div>

        {!isOwnProfile && (
          <button
            onClick={handleRate}
            className="bg-[#6D28D9] text-white font-bold px-5 py-3 rounded-xl hover:bg-[#5b21b6] transition-colors text-sm cursor-pointer shadow-sm flex items-center justify-center"
          >
            <Star className="w-4 h-4 text-yellow-400 mr-2" />
            {myRating ? "Modifier mon avis" : "Donner mon avis"}
          </button>
        )}
      </div>

      {showModal && (
        <RatingModal
          nickname={nickname}
          onClose={() => setShowModal(false)}
          initialScore={myRating?.score || 0}
          initialComment={myRating?.comment || ""}
          onSuccess={(avg, cnt, score, comment) => {
            setAverage(avg);
            setCount(cnt);
            setMyRating({
              user_id: user?.id ?? 0,
              score,
              comment,
            });
            setShowModal(false);
          }}
        />
      )}
    </>
  );
}